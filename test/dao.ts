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

import { BigNumber, Contract, ContractReceipt } from "ethers";

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

const getEventData = (
    eventName: string,
    contract: Contract,
    txResult: ContractReceipt
): any => {
    if (!Array.isArray(txResult.logs)) return null;
    for (let log of txResult.logs) {
        try {
            const decoded = contract.interface.parseLog(log);
            if (decoded.name === eventName)
                return {
                    ...decoded,
                    ...decoded.args
                };
        } catch (error) { }
    }
    return null;
};

describe('DAO common Test', () => {
    let xxxToken: XXXToken;
    let lptoken: XXXToken;
    let staking: Staking;
    let dao: DAO;
    let signers: SignerWithAddress[]
    let owner: SignerWithAddress;
    let acc1: SignerWithAddress;
    let acc2: SignerWithAddress;
    let acc3: SignerWithAddress;
    let chairPerson: SignerWithAddress;
    let proposalId: any;

    let tree: MerkleTree;
    let wlAddresses;

    beforeEach(async () => {
        signers = await ethers.getSigners();
        let network = await ethers.provider.getNetwork();

        owner = signers[0];
        acc1 = signers[1];
        acc2 = signers[2];
        acc3 = signers[3];
        chairPerson = signers[4];


        wlAddresses = [
            owner.address,
            acc1.address,
            acc2.address,
            acc3.address
          ]
        tree = getTree(wlAddresses);

        lptoken = (await deployContract(signers[0], XXXTokenArtifacts)) as XXXToken
        xxxToken = (await deployContract(signers[0], XXXTokenArtifacts)) as XXXToken
        staking = (await deployContract(signers[0], StakingArtifacts, 
            [lptoken.address, xxxToken.address, tree.getHexRoot()])) as Staking
        dao = (await deployContract(signers[0], DAOArtifacts,
            [chairPerson.address, staking.address, ethers.utils.parseEther("10.0"), 3600 * 24 * 3])) as DAO;
        await staking.setDao(dao.address);

        await lptoken.mint(acc1.address, ethers.utils.parseEther("100.0"))
        await lptoken.mint(acc2.address, ethers.utils.parseEther("100.0"))
        await lptoken.mint(acc3.address, ethers.utils.parseEther("100.0"))

        await lptoken.connect(acc1).approve(staking.address, ethers.utils.parseEther("100.0"));
        await lptoken.connect(acc2).approve(staking.address, ethers.utils.parseEther("100.0"));
        await lptoken.connect(acc3).approve(staking.address, ethers.utils.parseEther("100.0"));

        const receipt = await (
            await dao.connect(chairPerson)
                .addProposal(
                    staking.address, getSignature(10), "test"))
            .wait();

        proposalId = getEventData("AddProposal", dao, receipt).proposalId as BigNumber;
    })

    it('getSignature should be correct', async () => {
        expect((await dao.getSignature(0))).to.eq(getSignature(10))
    })

    it('getDescription should be correct', async () => {
        expect((await dao.getDescription(proposalId))).to.eq("test")
    })

    it('getRecipient should be correct', async () => {
        expect((await dao.getRecipient(proposalId))).to.eq(staking.address)
    })

    it('getVotes should be correct', async () => {
        await staking.connect(acc1).stake(ethers.utils.parseEther("3.0"), tree.getHexProof(getLeaf(acc1.address)));
        await staking.connect(acc2).stake(ethers.utils.parseEther("5.0"), tree.getHexProof(getLeaf(acc2.address)));
        await staking.connect(acc3).stake(ethers.utils.parseEther("9.0"), tree.getHexProof(getLeaf(acc3.address)));

        await dao.connect(acc1).vote(proposalId, true)
        await dao.connect(acc2).vote(proposalId, false)
        await dao.connect(acc3).vote(proposalId, true)

        expect((await dao.getVotes(proposalId, true))).to.eq(ethers.utils.parseEther("12.0"))
        expect((await dao.getVotes(proposalId, false))).to.eq(ethers.utils.parseEther("5.0"))
    })

    it('delegation with with zero deposits should be reverted', async () => {
        await expect(dao.connect(acc1).delegate(proposalId, acc2.address)).to.be.revertedWith(
            "deposite is 0"
        );
    })

    it('isExist is correct', async () => {
        await expect(dao.connect(acc1).getSignature(2)).to.be.revertedWith(
            "not exist"
        );
    })

    it('delegation to voted address should be reverted', async () => {
        await staking.connect(acc2).stake(ethers.utils.parseEther("5.0"), tree.getHexProof(getLeaf(acc2.address)));
        await dao.connect(acc2).vote(proposalId, false)
        await staking.connect(acc1).stake(ethers.utils.parseEther("3.0"), tree.getHexProof(getLeaf(acc1.address)));

        await expect(dao.connect(acc1).delegate(proposalId, acc2.address)).to.be.revertedWith(
            "delegation to voted"
        );
    })

    it('second delegation to address should be reverted', async () => {
        await staking.connect(acc1).stake(ethers.utils.parseEther("3.0"), tree.getHexProof(getLeaf(acc1.address)));
        await dao.connect(acc1).delegate(proposalId, acc2.address);

        await expect(dao.connect(acc1).delegate(proposalId, acc3.address)).to.be.revertedWith(
            "already voted or delegated"
        );
    })

    it('delegation should be correct', async () => {
        await staking.connect(acc1).stake(ethers.utils.parseEther("3.0"), tree.getHexProof(getLeaf(acc1.address)));
        await dao.connect(acc1).delegate(proposalId, acc2.address);

        await staking.connect(acc3).stake(ethers.utils.parseEther("7.0"), tree.getHexProof(getLeaf(acc3.address)));
        await dao.connect(acc3).delegate(proposalId, acc2.address);

        await staking.connect(acc2).stake(ethers.utils.parseEther("5.0"), tree.getHexProof(getLeaf(acc2.address)));

        await dao.connect(acc2).vote(proposalId, false)
        expect((await dao.getVotes(proposalId, false))).to.eq(ethers.utils.parseEther("15.0"))
    })

    it('addProposal should be correct', async () => {
        const receipt = await (
            await dao.connect(chairPerson)
                .addProposal(
                    acc3.address, getSignature(20), "testDescription"))
            .wait();

        let proposalId2 = getEventData("AddProposal", dao, receipt).proposalId as BigNumber;
        expect(proposalId2).to.eq(1)
        expect((await dao.getSignature(proposalId2))).to.eq(getSignature(20))
        expect((await dao.getDescription(proposalId2))).to.eq("testDescription")
        expect((await dao.getRecipient(proposalId2))).to.eq(acc3.address)
    })

    it('voting with overtime should be reverted', async () => {
        await staking.connect(acc1).stake(ethers.utils.parseEther("3.0"), tree.getHexProof(getLeaf(acc1.address)));

        await network.provider.send("evm_increaseTime", [3600 * 24 * 3 + 1])
        await network.provider.send("evm_mine");

        await expect(dao.connect(acc1).vote(proposalId, true)).to.be.revertedWith(
            "voting is over"
        );
    })

    it('second voting should be reverted', async () => {
        await staking.connect(acc1).stake(ethers.utils.parseEther("3.0"), tree.getHexProof(getLeaf(acc1.address)));
        await dao.connect(acc1).vote(proposalId, true);

        await expect(dao.connect(acc1).vote(proposalId, false)).to.be.revertedWith(
            "already voted"
        );
    })

    it('voting with delegetion should be reverted', async () => {
        await staking.connect(acc1).stake(ethers.utils.parseEther("3.0"), tree.getHexProof(getLeaf(acc1.address)));
        await dao.connect(acc1).delegate(proposalId, acc2.address);

        await expect(dao.connect(acc1).vote(proposalId, false)).to.be.revertedWith(
            "already voted or delegated"
        );
    })

    it('voting with zero balance should be reverted', async () => {
        await expect(dao.connect(acc1).vote(proposalId, false)).to.be.revertedWith(
            "voting tokens are 0"
        );
    })

    it('voting with zero balance and delegation should be correct', async () => {
        await staking.connect(acc1).stake(ethers.utils.parseEther("3.0"), tree.getHexProof(getLeaf(acc1.address)));
        await dao.connect(acc1).delegate(proposalId, acc2.address);

        await dao.connect(acc2).vote(proposalId, false);

        expect((await dao.getVotes(proposalId, true))).to.eq(0)
        expect((await dao.getVotes(proposalId, false))).to.eq(ethers.utils.parseEther("3.0"))
    })

    it('finishProposal should be reverted if voting in progress', async () => {
        await expect(dao.connect(acc1).finishProposal(proposalId)).to.be.revertedWith(
            "voting in progress"
        );
    })

    it('finishProposal should be reverted if voting is finished', async () => {
        await network.provider.send("evm_increaseTime", [3600 * 24 * 3 + 1])
        await network.provider.send("evm_mine");

        await dao.connect(acc1).finishProposal(proposalId);

        await expect(dao.connect(acc1).finishProposal(proposalId)).to.be.revertedWith(
            "voting is finished"
        );
    })

    it('finishProposal with MinimumQuorumNotReached-event should be correct', async () => {
        await staking.connect(acc1).stake(ethers.utils.parseEther("1.0"), tree.getHexProof(getLeaf(acc1.address)));
        await dao.connect(acc1).vote(proposalId, true);

        await staking.connect(acc2).stake(ethers.utils.parseEther("3.0"), tree.getHexProof(getLeaf(acc2.address)));
        await dao.connect(acc2).vote(proposalId, false);

        await network.provider.send("evm_increaseTime", [3600 * 24 * 3 + 1])
        await network.provider.send("evm_mine");

        expect(await staking.getTimeToUnstake()).to.eq(3600 * 24 * 3);

        const receipt = await (
            await dao.connect(chairPerson)
                .finishProposal(proposalId))
            .wait();

        let eventProposalId = getEventData("MinimumQuorumNotReached", dao, receipt).proposalId as BigNumber;
        expect(eventProposalId).to.eq(proposalId)
        expect(await staking.getTimeToUnstake()).to.eq(3600 * 24 * 3);
    })

    it('finishProposal with rejected proposal should be correct', async () => {
        await staking.connect(acc1).stake(ethers.utils.parseEther("8.0"), tree.getHexProof(getLeaf(acc1.address)));
        await dao.connect(acc1).vote(proposalId, false);

        await staking.connect(acc2).stake(ethers.utils.parseEther("3.0"), tree.getHexProof(getLeaf(acc2.address)));
        await dao.connect(acc2).vote(proposalId, true);

        await network.provider.send("evm_increaseTime", [3600 * 24 * 3 + 1])
        await network.provider.send("evm_mine");

        expect(await staking.getTimeToUnstake()).to.eq(3600 * 24 * 3);

        const receipt = await (
            await dao.connect(chairPerson)
                .finishProposal(proposalId))
            .wait();

        let eventProposalId = getEventData("ProposalRejected", dao, receipt).proposalId as BigNumber;
        expect(eventProposalId).to.eq(proposalId)
        expect(await staking.getTimeToUnstake()).to.eq(3600 * 24 * 3);
    })

    it('finishProposal with approved proposal should be correct', async () => {
        await staking.connect(acc1).stake(ethers.utils.parseEther("8.0"), tree.getHexProof(getLeaf(acc1.address)));
        await dao.connect(acc1).vote(proposalId, true);

        await staking.connect(acc2).stake(ethers.utils.parseEther("3.0"), tree.getHexProof(getLeaf(acc2.address)));
        await dao.connect(acc2).vote(proposalId, false);

        await network.provider.send("evm_increaseTime", [3600 * 24 * 3 + 1])
        await network.provider.send("evm_mine");

        expect(await staking.getTimeToUnstake()).to.eq(3600 * 24 * 3);

        const receipt = await (
            await dao.connect(chairPerson)
                .finishProposal(proposalId))
            .wait();

        let eventProposalId = getEventData("CallStatus", dao, receipt).proposalId as BigNumber;
        let status = getEventData("CallStatus", dao, receipt).status as Boolean;
        expect(eventProposalId).to.eq(proposalId)
        expect(status).to.eq(true)
        expect(await staking.getTimeToUnstake()).to.eq(10);
    })

    it('only chairPerson can add a proposal', async () => {
        await expect(dao.connect(acc1)
            .addProposal(
                staking.address, getSignature(10), "test")).to.be.revertedWith(
                    "not a chair person"
                );
    })

})