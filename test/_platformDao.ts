import { ethers, waffle, web3, network } from 'hardhat'

import chai from 'chai'

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address"

import ACDMPlatformArtifacts from '../artifacts/contracts/ACDMPlatform.sol/ACDMPlatform.json'
import { ACDMPlatform } from '../src/types/ACDMPlatform'

import ACDMTokenArtifacts from '../artifacts/contracts/ACDMToken.sol/ACDMToken.json'
import { ACDMToken } from '../src/types/ACDMToken'

import DAOArtifacts from '../artifacts/contracts/DAO.sol/DAO.json'
import { DAO } from '../src/types/DAO'

import StakingArtifacts from '../artifacts/contracts/Staking.sol/Staking.json'
import { Staking } from '../src/types/Staking'

import XXXTokenArtifacts from '../artifacts/contracts/XXXToken.sol/XXXToken.json'
import { XXXToken } from '../src/types/XXXToken'

import IUniswapV2Router02Artifacts from '../artifacts/contracts/interfaces/IUniswapV2Router02.sol/IUniswapV2Router02.json'
import { IUniswapV2Router02 } from '../src/types/IUniswapV2Router02'

import IUniswapV2FactoryArtifacts from '../artifacts/contracts/interfaces/IUniswapV2Factory.sol/IUniswapV2Factory.json'
import { IUniswapV2Factory } from '../src/types/IUniswapV2Factory'

import IUniswapV2PairArtifacts from '../artifacts/contracts/interfaces/IUniswapV2Pair.sol/IUniswapV2Pair.json'
import { IUniswapV2Pair } from '../src/types/IUniswapV2Pair'

const { deployContract } = waffle
const { expect } = chai

import { BigNumber, Contract, ContractReceipt } from "ethers";

import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';

const uniswapV2Router02address = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

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

describe("ACDMPlatform - dao test", function () {
    let acdmPlatform: ACDMPlatform;
    let acdmToken: ACDMToken;
    let dao: DAO;
    let xxxToken: XXXToken;
    let lptoken: XXXToken;
    let staking: Staking;
    let signers: SignerWithAddress[]

    let owner: SignerWithAddress;
    let acc1: SignerWithAddress;
    let acc2: SignerWithAddress;
    let acc3: SignerWithAddress;
    let chairPerson: SignerWithAddress;

    let tree: MerkleTree;
    let wlAddresses;

    beforeEach(async () => {
        signers = await ethers.getSigners();

        owner = signers[0];
        acc1 = signers[1];
        acc2 = signers[2];
        acc3 = signers[3];
        chairPerson = signers[4];

        wlAddresses = [
            owner.address,
            acc1.address,
            acc2.address
          ]
        tree = getTree(wlAddresses);

        acdmToken = (await deployContract(owner, ACDMTokenArtifacts)) as ACDMToken;

        lptoken = (await deployContract(signers[0], XXXTokenArtifacts)) as XXXToken
        xxxToken = (await deployContract(signers[0], XXXTokenArtifacts)) as XXXToken
        staking = (await deployContract(signers[0], StakingArtifacts, 
            [lptoken.address, xxxToken.address, tree.getHexRoot()])) as Staking
        dao = (await deployContract(signers[0], DAOArtifacts,
            [chairPerson.address, staking.address, ethers.utils.parseEther("10.0"), 3600 * 24 * 3])) as DAO;

        acdmPlatform = (await deployContract(owner, ACDMPlatformArtifacts,
            [acdmToken.address, dao.address, xxxToken.address])) as ACDMPlatform;
        
        await staking.setDao(dao.address)
        await acdmToken.setPlatform(acdmPlatform.address);
        await acdmPlatform.startFirstSaleRound();
    })

    it('setRoot test', async () => {
        let newWlAddresses = [
            acc1.address,
            acc2.address
          ]
        let newTree = getTree(newWlAddresses);
        let newRoot = newTree.getHexRoot();

        const signature = web3.eth.abi.encodeFunctionCall({
            name: 'setRoot',
            type: 'function',
            inputs: [{
                type: 'bytes32',
                name: '_root'
            }
            ]}, [newRoot]);
        
        await dao.connect(chairPerson).addProposal(staking.address, signature, "test");
        await lptoken.mint(owner.address, ethers.utils.parseEther("100.0"))
        await lptoken.approve(staking.address, ethers.utils.parseEther("100.0"));
        await staking.stake(ethers.utils.parseEther("10.0"), tree.getHexProof(getLeaf(owner.address)));
        await dao.vote(0, true);
        await network.provider.send("evm_increaseTime", [3600 * 24 * 3 + 1])
        await network.provider.send("evm_mine");
        const receipt = await (
            await dao.finishProposal(0))
            .wait();

        let eventProposalId = getEventData("CallStatus", dao, receipt).proposalId as BigNumber;
        let status = getEventData("CallStatus", dao, receipt).status as Boolean;
        expect(eventProposalId).to.eq(0)
        expect(status).to.eq(true)

        let newStackingRoot = await staking.getRoot();
        expect(newStackingRoot).to.eq(newRoot)

        await expect(staking.stake(ethers.utils.parseEther("10.0"), tree.getHexProof(getLeaf(owner.address)))).to.be.revertedWith(
            "not in white list"
        );
    })

    it('burnXXXToken test', async () => {
        let provider = await ethers.getDefaultProvider();

        const options = {
            gasLimit: 6721975,
        }

        const optionsWithEther = {
            value: ethers.utils.parseEther("1.0"),
            gasLimit: 6721975
        }

        let uniswapV2Router02 =
            new ethers.Contract(uniswapV2Router02address, IUniswapV2Router02Artifacts.abi, owner) as IUniswapV2Router02;

        let factoryAddress = await uniswapV2Router02.factory();
        let wethAddress = await uniswapV2Router02.WETH();

        let uniswapV2Factory =
            new ethers.Contract(factoryAddress, IUniswapV2FactoryArtifacts.abi, owner) as IUniswapV2Factory;

        await uniswapV2Factory.createPair(xxxToken.address, wethAddress);

        let poolAdresse = await uniswapV2Factory.getPair(xxxToken.address, wethAddress);
        let uniswapV2Pair =
            new ethers.Contract(poolAdresse, IUniswapV2PairArtifacts.abi, owner) as IUniswapV2Pair;
        await xxxToken.mint(owner.address, ethers.utils.parseEther("100000.0"))
        await xxxToken.approve(uniswapV2Router02.address, ethers.utils.parseEther("100000.0"));

        let lastblock = await provider.getBlock(provider._lastBlockNumber);

        await uniswapV2Router02.addLiquidityETH(
            xxxToken.address,
            ethers.utils.parseEther("100000.0"),
            ethers.utils.parseEther("1.0"),
            ethers.utils.parseEther("100000.0"),
            owner.address,
            lastblock.timestamp + 36000,
            optionsWithEther);

        let [e1, t1] = await uniswapV2Pair.getReserves();

        let jsonAbi = [{
            "inputs": [],
            "name": "burnXXXToken",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }];
        const iface = new ethers.utils.Interface(jsonAbi);
        let signature = iface.encodeFunctionData('burnXXXToken', []);

        await dao.connect(chairPerson).addProposal(acdmPlatform.address, signature, "test");
        await lptoken.mint(owner.address, ethers.utils.parseEther("100.0"))
        await lptoken.approve(staking.address, ethers.utils.parseEther("100.0"));
        await staking.stake(ethers.utils.parseEther("10.0"), tree.getHexProof(getLeaf(owner.address)));
        await dao.vote(0, true);
        await network.provider.send("evm_increaseTime", [3600 * 24 * 3 + 1])
        await network.provider.send("evm_mine");

        let price = await acdmPlatform.acdmPrice();

        await acdmPlatform.buyACDM({ value: price.mul(1000) })
        await acdmPlatform.startTradeRound();
        await acdmToken.approve(acdmPlatform.address, ethers.utils.parseUnits("1000.0", "6"))
        await acdmPlatform.addOrder(1000, price)

        await acdmPlatform.connect(acc1).buy(0, 1000, { value: price.mul(1000) });

        let totalTokensBefore = await xxxToken.totalSupply()
        const receipt = await (
            await dao.finishProposal(0, options))
            .wait();

        let eventProposalId = getEventData("CallStatus", dao, receipt).proposalId as BigNumber;
        let status = getEventData("CallStatus", dao, receipt).status as Boolean;
        expect(eventProposalId).to.eq(0)
        expect(status).to.eq(true);

        let [e2, t2] = await uniswapV2Pair.getReserves();
        let totalTokensAfter = await xxxToken.totalSupply()
        expect(t2.lt(t1)).to.eq(true);
        expect(e2.gt(e1)).to.eq(true);
        expect(totalTokensAfter.lt(totalTokensBefore)).to.eq(true);
    })

    it('setFirstLevelSaleAward test', async () => {
        let jsonAbi = [{
            "inputs": [
                {
                    "internalType": "uint64",
                    "name": "_sr1",
                    "type": "uint64"
                }
            ],
            "name": "setFirstLevelSaleAward",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }
        ];
        const iface = new ethers.utils.Interface(jsonAbi);
        let signature = iface.encodeFunctionData('setFirstLevelSaleAward', [100]);

        await dao.connect(chairPerson).addProposal(acdmPlatform.address, signature, "test");
        await lptoken.mint(owner.address, ethers.utils.parseEther("100.0"))
        await lptoken.approve(staking.address, ethers.utils.parseEther("100.0"));
        await staking.stake(ethers.utils.parseEther("10.0"), tree.getHexProof(getLeaf(owner.address)));
        await dao.vote(0, true);
        await network.provider.send("evm_increaseTime", [3600 * 24 * 3 + 1])
        await network.provider.send("evm_mine");
        const receipt = await (
            await dao.finishProposal(0))
            .wait();

        let eventProposalId = getEventData("CallStatus", dao, receipt).proposalId as BigNumber;
        let status = getEventData("CallStatus", dao, receipt).status as Boolean;
        expect(eventProposalId).to.eq(0)
        expect(status).to.eq(true)

        await acdmPlatform.register(acc1.address);
        let price = await acdmPlatform.acdmPrice();

        const voteTx = await acdmPlatform.buyACDM({ value: price.mul(1000) })
        await expect(() => voteTx).to.changeEtherBalance(owner, price.mul(-1000))
        await expect(() => voteTx).to.changeEtherBalance(acdmPlatform, price.mul(900))
        await expect(() => voteTx).to.changeEtherBalance(acc1, price.mul(100))
    })

    it('setSecondLevelSaleAward test', async () => {
        let jsonAbi = [{
            "inputs": [
                {
                    "internalType": "uint64",
                    "name": "_sr2",
                    "type": "uint64"
                }
            ],
            "name": "setSecondLevelSaleAward",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }
        ];
        const iface = new ethers.utils.Interface(jsonAbi);
        let signature = iface.encodeFunctionData('setSecondLevelSaleAward', [100]);

        await dao.connect(chairPerson).addProposal(acdmPlatform.address, signature, "test");
        await lptoken.mint(owner.address, ethers.utils.parseEther("100.0"))
        await lptoken.approve(staking.address, ethers.utils.parseEther("100.0"));
        await staking.stake(ethers.utils.parseEther("10.0"), tree.getHexProof(getLeaf(owner.address)));
        await dao.vote(0, true);
        await network.provider.send("evm_increaseTime", [3600 * 24 * 3 + 1])
        await network.provider.send("evm_mine");
        const receipt = await (
            await dao.finishProposal(0))
            .wait();

        let eventProposalId = getEventData("CallStatus", dao, receipt).proposalId as BigNumber;
        let status = getEventData("CallStatus", dao, receipt).status as Boolean;
        expect(eventProposalId).to.eq(0)
        expect(status).to.eq(true)

        await acdmPlatform.register(acc1.address);
        await acdmPlatform.connect(acc1).register(acc2.address);
        let price = await acdmPlatform.acdmPrice();

        const voteTx = await acdmPlatform.buyACDM({ value: price.mul(1000) })
        await expect(() => voteTx).to.changeEtherBalance(owner, price.mul(-1000))
        await expect(() => voteTx).to.changeEtherBalance(acdmPlatform, price.mul(850))
        await expect(() => voteTx).to.changeEtherBalance(acc1, price.mul(50))
        await expect(() => voteTx).to.changeEtherBalance(acc2, price.mul(100))
    })

    it('setTradeAward test', async () => {
        let jsonAbi = [{
            "inputs": [
                {
                    "internalType": "uint64",
                    "name": "_tr",
                    "type": "uint64"
                }
            ],
            "name": "setTradeAward",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }
        ];
        const iface = new ethers.utils.Interface(jsonAbi);
        let signature = iface.encodeFunctionData('setTradeAward', [100]);

        await dao.connect(chairPerson).addProposal(acdmPlatform.address, signature, "test");
        await lptoken.mint(owner.address, ethers.utils.parseEther("100.0"))
        await lptoken.approve(staking.address, ethers.utils.parseEther("100.0"));
        await staking.stake(ethers.utils.parseEther("10.0"), tree.getHexProof(getLeaf(owner.address)));
        await dao.vote(0, true);
        await network.provider.send("evm_increaseTime", [3600 * 24 * 3 + 1])
        await network.provider.send("evm_mine");
        const receipt = await (
            await dao.finishProposal(0))
            .wait();

        let eventProposalId = getEventData("CallStatus", dao, receipt).proposalId as BigNumber;
        let status = getEventData("CallStatus", dao, receipt).status as Boolean;
        expect(eventProposalId).to.eq(0)
        expect(status).to.eq(true)

        await acdmPlatform.register(acc2.address);
        let price = await acdmPlatform.acdmPrice();

        await acdmPlatform.buyACDM({ value: price.mul(1000) })
        await acdmPlatform.startTradeRound();
        await acdmToken.approve(acdmPlatform.address, ethers.utils.parseUnits("1000.0", "6"))
        await acdmPlatform.addOrder(1000, price)

        const voteTx = await acdmPlatform.connect(acc1).buy(0, 1000, { value: price.mul(1000) });
        await expect(() => voteTx).to.changeEtherBalance(acc2,
            price.mul(1000).mul(10).div(100))
    })

    it('sendSavedEthersToOwner test', async () => {
        let jsonAbi = [{
            "inputs": [],
            "name": "sendSavedEthersToOwner",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }
        ];
        const iface = new ethers.utils.Interface(jsonAbi);
        let signature = iface.encodeFunctionData('sendSavedEthersToOwner', []);

        await dao.connect(chairPerson).addProposal(acdmPlatform.address, signature, "test");
        await lptoken.mint(owner.address, ethers.utils.parseEther("100.0"))
        await lptoken.approve(staking.address, ethers.utils.parseEther("100.0"));
        await staking.stake(ethers.utils.parseEther("10.0"), tree.getHexProof(getLeaf(owner.address)));
        await dao.vote(0, true);
        await network.provider.send("evm_increaseTime", [3600 * 24 * 3 + 1])
        await network.provider.send("evm_mine");

        let price = await acdmPlatform.acdmPrice();

        await acdmPlatform.buyACDM({ value: price.mul(1000) })
        await acdmPlatform.startTradeRound();
        await acdmToken.approve(acdmPlatform.address, ethers.utils.parseUnits("1000.0", "6"))
        await acdmPlatform.addOrder(1000, price)

        const voteTx = await acdmPlatform.connect(acc1).buy(0, 1000, { value: price.mul(1000) });
        await expect(() => voteTx).to.changeEtherBalance(acdmPlatform,
            price.mul(1000).mul(5).div(100))

        const receipt = await (
            await dao.finishProposal(0));

        await expect(() => receipt).to.changeEtherBalance(owner,
            price.mul(1000).mul(5).div(100))
        await expect(() => receipt).to.changeEtherBalance(acdmPlatform,
            price.mul(-1000).mul(5).div(100))
    })

    it('onlyDao test', async () => {
        await expect(acdmPlatform.setFirstLevelSaleAward(0)).to.be.revertedWith(
            "only dao"
        );
    })
});