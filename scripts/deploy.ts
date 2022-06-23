import { ethers } from "hardhat";
import hre from 'hardhat'

import config from '../config.json'

async function main() {
  const Staking = await ethers.getContractFactory("Staking");
  const staking = await Staking.deploy(
    config.XxxEthPairAddress,
    config.XXXToken
  );
  await staking.deployed();
  console.log("staking deployed to: ", staking.address);

  let chairPersonAddress = (await ethers.getSigners())[0].address;
  let minimumQuorum = hre.ethers.utils.parseEther(config.minimumQuorum)
  const DAO = await ethers.getContractFactory("DAO");
  const dao = await DAO.deploy(
    chairPersonAddress,
    staking.address,
    minimumQuorum,
    config.debatingPeriodDuration);
  await dao.deployed();
  console.log("dao deployed to: ", dao.address);

  await staking.setDao(dao.address);

  const ACDMToken = await ethers.getContractFactory("ACDMToken");
  const acdmToken = await ACDMToken.deploy();

  await acdmToken.deployed();

  console.log("ACDMToken deployed to: ", acdmToken.address);

  const ACDMPlatform = await ethers.getContractFactory("ACDMPlatform");
  const acdmPlatform = await ACDMPlatform.deploy(
    acdmToken.address,
    dao.address,
    config.XXXToken
  );
  await acdmPlatform.deployed();

  await acdmToken.setPlatform(acdmPlatform.address);
  console.log("ACDMPlatform deployed to: ", acdmPlatform.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
