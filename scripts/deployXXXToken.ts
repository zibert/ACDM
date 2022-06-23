import { ethers } from "hardhat";
import hre from 'hardhat'

import config from '../config.json'

async function main() {
  const XXXToken = await ethers.getContractFactory("XXXToken");
  const xxxToken = await XXXToken.deploy();

  await xxxToken.deployed();

  console.log("XXXToken deployed to:", xxxToken.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
