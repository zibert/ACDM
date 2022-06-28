import { ethers, waffle, network, web3 } from 'hardhat'
import chai from 'chai'

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address"

import StakingArtifacts from '../artifacts/contracts/Staking.sol/Staking.json'
import { Staking } from '../src/types/Staking'

import XXXTokenArtifacts from '../artifacts/contracts/XXXToken.sol/XXXToken.json'
import { XXXToken } from '../src/types/XXXToken'

import DAOArtifacts from '../artifacts/contracts/DAO.sol/DAO.json'
import { DAO } from '../src/types/DAO'

const { deployContract } = waffle
const { expect } = chai

import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';

const getTree = function (addresses: any[]) {
    const leaves = addresses.map(addr => keccak256(web3.eth.abi.encodeParameters(['address'], [addr])))
        
    const tree = new MerkleTree(leaves, keccak256, {
      sortLeaves: true,
      sortPairs: true
    })
    return tree;
}

const getLeaf = function (address: any) {
    return keccak256(web3.eth.abi.encodeParameters(['address'], [address]))
}

const getSignature = function (value: any) {
    var jsonAbi = [{
        "inputs": [
            {
                "internalType": "uint64",
                "name": "_timeToUnstake",
                "type": "uint64"
            }
        ],
        "name": "setTimeToUnstake",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
    ];
    const iface = new ethers.utils.Interface(jsonAbi);
    return iface.encodeFunctionData('setTimeToUnstake', [value]);
}

describe('Staking common Test', () => {
    let xxxToken: XXXToken;
    let lptoken: XXXToken;
    let staking: Staking;
    let dao: DAO;
    let signers: SignerWithAddress[]
    let owner: SignerWithAddress;
    let acc1: SignerWithAddress;
    let acc2: SignerWithAddress;
    let acc3: SignerWithAddress;

    let tree: MerkleTree;
    let wlAddresses;

    beforeEach(async () => {
        signers = await ethers.getSigners();
        let network = await ethers.provider.getNetwork();

        owner = signers[0];
        acc1 = signers[1];
        acc2 = signers[2];
        acc3 = signers[3];

        wlAddresses = [
            owner.address,
            acc1.address,
            acc2.address
          ]
        tree = getTree(wlAddresses);

        xxxToken = (await deployContract(signers[0], XXXTokenArtifacts)) as XXXToken
        lptoken = (await deployContract(signers[0], XXXTokenArtifacts)) as XXXToken
        staking = (await deployContract(signers[0], StakingArtifacts, 
            [lptoken.address, xxxToken.address, tree.getHexRoot()])) as Staking
        dao = (await deployContract(signers[0], DAOArtifacts,
            [owner.address, staking.address, ethers.utils.parseEther("10.0"), 3600 * 24])) as DAO;
        await staking.setDao(dao.address);

        await xxxToken.mint(staking.address, ethers.utils.parseEther("100.0"));

        await lptoken.mint(owner.address, ethers.utils.parseEther("10.0"));
        await lptoken.approve(staking.address, ethers.utils.parseEther("10.0"));
    })

    it('setDao should be correct', async () => {
        await staking.setDao(acc2.address);
        expect(await staking.getDao()).to.eq(acc2.address)
    })

    it('setDao should be reverted if not owner call it', async () => {
        await expect(staking.connect(acc1).setDao(acc2.address)).to.be.revertedWith(
            "only owner"
        );
    })

    it('stake should be reverted if nothing was sent', async () => {
        await expect(staking.stake(0, tree.getHexProof(getLeaf(owner.address)))).to.be.revertedWith(
            "amount must be more then 0"
        );
    })

    it('stake should be correct', async () => {
        expect(await staking.getBalance(owner.address)).to.eq(0)
        await staking.stake(ethers.utils.parseEther("1"), tree.getHexProof(getLeaf(owner.address)));
        expect(await staking.getBalance(owner.address)).to.eq(ethers.utils.parseEther("1"))
    })

    it('claim should be reverted if not owner call it', async () => {
        await staking.stake(ethers.utils.parseEther("1"), tree.getHexProof(getLeaf(owner.address)));
        await expect(staking.connect(acc1).claim(0)).to.be.revertedWith(
            "you are not a owner"
        );
    })

    it('claim should be revertedif there is no award yet', async () => {
        await staking.stake(ethers.utils.parseEther("1"), tree.getHexProof(getLeaf(owner.address)));
        await expect(staking.claim(0)).to.be.revertedWith(
            "nothing to transfer"
        );
    })

    it('claim should be correct', async () => {
        await staking.stake(ethers.utils.parseEther("10"), tree.getHexProof(getLeaf(owner.address)));

        await network.provider.send("evm_increaseTime", [3600 * 24 * 10 + 1])
        await network.provider.send("evm_mine")

        expect(await xxxToken.balanceOf(owner.address)).to.eq(0)
        await staking.claim(0);
        expect(await xxxToken.balanceOf(owner.address)).to.eq(ethers.utils.parseEther("0.3"))

        await network.provider.send("evm_increaseTime", [3600 * 24 * 4 + 1])
        await network.provider.send("evm_mine")

        await staking.claim(0);
        expect(await xxxToken.balanceOf(owner.address)).to.eq(ethers.utils.parseEther("0.6"))

        await network.provider.send("evm_increaseTime", [3600 * 24 * 15 + 1])
        await network.provider.send("evm_mine")

        await staking.claim(0);
        expect(await xxxToken.balanceOf(owner.address)).to.eq(ethers.utils.parseEther("1.2"))
    })


    it('claim should be rewverted if requested twice', async () => {
        await staking.stake(ethers.utils.parseEther("10"), tree.getHexProof(getLeaf(owner.address)));

        await network.provider.send("evm_increaseTime", [3600 * 24 * 7 + 1])
        await network.provider.send("evm_mine")

        await staking.claim(0);
        await expect(staking.claim(0)).to.be.revertedWith(
            "nothing to transfer"
        );
    })

    it('unstake should be reverted if it is not the owner who has requested it', async () => {
        await staking.stake(ethers.utils.parseEther("10"), tree.getHexProof(getLeaf(owner.address)));

        await expect(staking.connect(acc1).unstake(0)).to.be.revertedWith(
            "you are not a owner"
        );
    })

    it('unstake should be reverted if requested twice', async () => {
        await staking.stake(ethers.utils.parseEther("10"), tree.getHexProof(getLeaf(owner.address)));

        await network.provider.send("evm_increaseTime", [3600 * 24 * 3 + 1])
        await network.provider.send("evm_mine")

        await staking.unstake(0);
        await expect(staking.unstake(0)).to.be.revertedWith(
            "already requested"
        );
    })

    it('unstake should be reverted if the necessary time has not yet past', async () => {
        await staking.stake(ethers.utils.parseEther("10"), tree.getHexProof(getLeaf(owner.address)));

        await expect(staking.unstake(0)).to.be.revertedWith(
            "time for unstaking has not come"
        );
    })

    it('unstake should be reverted if there is active voting', async () => {
        await staking.stake(ethers.utils.parseEther("10"), tree.getHexProof(getLeaf(owner.address)));
        await dao.addProposal(
            staking.address,
            "0xe3300f4d0000000000000000000000000000000000000000000000000000000000000014",
            "test");
        await dao.vote(0, true);

        await network.provider.send("evm_increaseTime", [3600 * 24 * 3 + 1])
        await network.provider.send("evm_mine")

        await expect(staking.unstake(0)).to.be.revertedWith(
            "you have active votings"
        );
    })

    it('unstake should be correct', async () => {
        await staking.stake(ethers.utils.parseEther("10"), tree.getHexProof(getLeaf(owner.address)));

        await network.provider.send("evm_increaseTime", [3600 * 24 * 3 + 1])
        await network.provider.send("evm_mine")

        expect(await lptoken.balanceOf(owner.address)).to.eq(0)
        await staking.unstake(0)
        expect(await lptoken.balanceOf(owner.address)).to.eq(ethers.utils.parseEther("10.0"))
    })

    it('setTimeToUnstake should be correct', async () => {
        await staking.stake(ethers.utils.parseEther("10"), tree.getHexProof(getLeaf(owner.address)));
        await dao.addProposal(
            staking.address,
            getSignature(42),
            "test");
        await dao.vote(0, true);

        await network.provider.send("evm_increaseTime", [3600 * 24 + 1])
        await network.provider.send("evm_mine")

        expect(await staking.getTimeToUnstake()).to.eq(3600 * 24 * 3)
        await dao.finishProposal(0);
        expect(await staking.getTimeToUnstake()).to.eq(42)
    })

    it('setTimeToUnstake should be reverted if dao is blank', async () => {
        await expect(staking.setTimeToUnstake(0)).to.be.revertedWith(
            "not allowed"
        );
    })
})

describe('Staking common Test', () => {
    let xxxToken: XXXToken;
    let lptoken: XXXToken;
    let staking: Staking;
    let signers: SignerWithAddress[]
    let owner: SignerWithAddress;
    let acc1: SignerWithAddress;
    let acc2: SignerWithAddress;
    let acc3: SignerWithAddress;

    let tree: MerkleTree;
    let wlAddresses;

    beforeEach(async () => {
        signers = await ethers.getSigners();

        owner = signers[0];
        acc1 = signers[1];
        acc2 = signers[2];
        acc3 = signers[3];

        wlAddresses = [
            owner.address,
            acc1.address,
            acc2.address
          ]
        tree = getTree(wlAddresses);

        xxxToken = (await deployContract(signers[0], XXXTokenArtifacts)) as XXXToken
        lptoken = (await deployContract(signers[0], XXXTokenArtifacts)) as XXXToken
        staking = (await deployContract(signers[0], StakingArtifacts, 
            [lptoken.address, xxxToken.address, tree.getHexRoot()])) as Staking
    })

    it('setTimeToUnstake should be reverted if not owner call it', async () => {
        await expect(staking.setTimeToUnstake(0)).to.be.revertedWith(
            "dao isin't init"
        );
    })

    it('stake should be reverted if not in white list', async () => {
        await expect(staking.connect(acc3).stake(ethers.utils.parseEther("10"), tree.getHexProof(getLeaf(acc3.address)))).to.be.revertedWith(
            "not in white list"
        );
    })
})