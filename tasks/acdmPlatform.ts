import { task } from "hardhat/config";

import { Contract, ContractReceipt } from "ethers";

import config from '../config.json'

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

task("register")
  .addParam("from", "from address")
  .setAction(async (args, hre) => {
    const platform = (await hre.ethers.getContractAt("ACDMPlatform", config.ACDMPlatform));
    await platform.register(args.from);
  });

task("startFirstSaleRound")
  .setAction(async (args, hre) => {
    const platform = (await hre.ethers.getContractAt("ACDMPlatform", config.ACDMPlatform));
    await platform.startFirstSaleRound();;
  });

task("startSaleRound")
  .setAction(async (args, hre) => {
    const platform = (await hre.ethers.getContractAt("ACDMPlatform", config.ACDMPlatform));
    await platform.startSaleRound();;
  });

task("startTradeRound")
  .setAction(async (args, hre) => {
    const platform = (await hre.ethers.getContractAt("ACDMPlatform", config.ACDMPlatform));
    await platform.startTradeRound();
  });

task("buyACDM")
  .addParam("ethers", "amount of ethers")
  .setAction(async (args, hre) => {
    const ethers = hre.ethers.utils.parseEther(args.ethers);

    const platform = (await hre.ethers.getContractAt("ACDMPlatform", config.ACDMPlatform));
    await platform.buyACDM({ value: ethers });
  });

task("addOrder")
  .addParam("amount", "amount of tokens")
  .addParam("price", "token price in ether")
  .setAction(async (args, hre) => {
    const platform = (await hre.ethers.getContractAt("ACDMPlatform", config.ACDMPlatform));

    const receipt = await (
      await platform.addOrder(args.amount, hre.ethers.utils.parseEther(args.price)))
      .wait();

    let id = getEventData("AddOrder", platform, receipt).id;
    console.log("order id: " + id)
  });

task("removeOrder")
  .addParam("id", "id of order")
  .setAction(async (args, hre) => {
    const platform = (await hre.ethers.getContractAt("ACDMPlatform", config.ACDMPlatform));
    await platform.removeOrder(args.id);
  });

task("buy")
  .addParam("id", "id of order")
  .addParam("amount", "amount of tokens")
  .setAction(async (args, hre) => {
    const platform = (await hre.ethers.getContractAt("ACDMPlatform", config.ACDMPlatform));
    const tokenPrice = await platform.acdmPrice();
    const value = tokenPrice.mul(args.amount)
    await platform.buy(args.id, args.amount, { value: value });
  });