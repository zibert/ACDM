import { task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";

import config from '../config.json'

task("mintXXX")
  .addParam("xxx", "xxx tokens")
  .addParam("to", "to address")
  .setAction(async (args, hre) => {
    const xxxToken = (await hre.ethers.getContractFactory("XXXToken")).attach(config.XXXToken);
    await xxxToken.mint(args.to, hre.ethers.utils.parseEther(args.xxx));
    const balance = await xxxToken.balanceOf(args.to);
    console.log(
      `balance are ${hre.ethers.utils.formatEther(balance)} tokens for address ${args.to}`
    );
  });