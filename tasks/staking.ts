import { task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";

import { Contract, ContractReceipt } from "ethers";

import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';

import config from '../config.json'
import { env } from "process";

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

const getLeaf = function (address: any) {
    return 
}

task("stake")
    .addParam("amount", "amount of tokens")
    .setAction(async (args, hre) => {
        const leafes = config.whiteList.map(
            addr => keccak256(hre.web3.eth.abi.encodeParameters(['address'], [addr]))
        )
        
        const tree = new MerkleTree(leafes, keccak256, {
            sortLeaves: true,
            sortPairs: true
        })

        let amount = hre.ethers.utils.parseEther(args.amount)
        let signers = await hre.ethers.getSigners();
        let user = signers[0]

        const uniswapV2Pair = (await hre.ethers.getContractAt("IUniswapV2Pair", config.XxxEthPairAddress))
        const staking = (await hre.ethers.getContractFactory("Staking")).attach(config.Staking);
        await uniswapV2Pair.approve(config.Staking, amount);

        const options = {
            gasLimit: 1000000
        }

        const receipt = await (
            await staking.stake(
                amount, 
                tree.getHexProof(keccak256(hre.web3.eth.abi.encodeParameters(['address'], [user.address]))), 
                options))
            .wait();

        console.log("staking id: " + getEventData("Stacked", staking, receipt).id);
    });

task("claim")
    .addParam("id", "id of staking")
    .setAction(async (args, hre) => {
        const staking = (await hre.ethers.getContractFactory("Staking")).attach(config.Staking);
        await staking.claim(args.id);
    });

task("unstake")
    .addParam("id", "id of staking")
    .setAction(async (args, hre) => {
        const staking = (await hre.ethers.getContractFactory("Staking")).attach(config.Staking);
        await staking.unstake(args.id);
    });