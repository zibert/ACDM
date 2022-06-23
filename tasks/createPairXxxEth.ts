
import { task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";

import config from '../config.json'

task("createPairXxxEth")
  .setAction(async (args, hre) => {
    let signers = await hre.ethers.getSigners();
    let owner = signers[0]

    const xxxToken = (await hre.ethers.getContractFactory("XXXToken")).attach(config.XXXToken);

    const uniswapV2Router02 =
      (await hre.ethers.getContractAt("IUniswapV2Router02", config.uniswapV2Router02))

    let factoryAddress = await uniswapV2Router02.factory();
    let wethAddress = await uniswapV2Router02.WETH();

    const uniswapV2Factory = (await hre.ethers.getContractAt("IUniswapV2Factory", factoryAddress))

    await uniswapV2Factory.createPair(xxxToken.address, wethAddress);
    let poolAdresse = await uniswapV2Factory.getPair(xxxToken.address, wethAddress);
    console.log("XxxEthPairAddress: " + poolAdresse)
  });