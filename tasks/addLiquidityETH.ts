import { task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";

import config from '../config.json'

task("addLiquidityETH")
    .addParam("ether", "ether")
    .addParam("xxx", "xxxToken")
    .setAction(async (args, hre) => {
        let signers = await hre.ethers.getSigners();
        let acc1 = signers[0]

        let provider = await hre.ethers.getDefaultProvider();

        const xxxToken = (await hre.ethers.getContractFactory("XXXToken")).attach(config.XXXToken);

        const uniswapV2Router02 = (await hre.ethers.getContractAt("IUniswapV2Router02",
            config.uniswapV2Router02))

        let factoryAddress = await uniswapV2Router02.factory();
        let wethAddress = await uniswapV2Router02.WETH();

        const uniswapV2Factory = (await hre.ethers.getContractAt("IUniswapV2Factory", factoryAddress))

        let poolAdresse = await uniswapV2Factory.getPair(xxxToken.address, wethAddress);
        await xxxToken.approve(factoryAddress, hre.ethers.utils.parseEther(args.xxx));

        const options = {
            value: hre.ethers.utils.parseEther(args.ether),
            gasLimit: 1000000
        }

        let lastblock = await provider.getBlock(provider._lastBlockNumber);

        await uniswapV2Router02.addLiquidityETH(
            xxxToken.address,
            hre.ethers.utils.parseEther(args.xxx),
            hre.ethers.utils.parseEther(args.ether),
            hre.ethers.utils.parseEther(args.xxx),
            acc1.address,
            lastblock.timestamp + 3600,
            options);

        const uniswapV2Pair = (await hre.ethers.getContractAt("IUniswapV2Pair", poolAdresse))

        let uniVsBalance = await uniswapV2Pair.balanceOf(acc1.address);
        console.log("uniswapV2Pair address: " + uniswapV2Pair.address);
        console.log("UNI-V2 balance: " + uniVsBalance);
    });