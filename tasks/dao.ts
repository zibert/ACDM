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

task("addProposal")
  .addParam("recipient", "recipient address")
  .addParam("signature", "signature")
  .addParam("description", "description")
  .setAction(async (args, hre) => {
    const dao = (await hre.ethers.getContractAt("DAO", config.Dao));

    const receipt = await (
      await dao.addProposal(
        args.recipient,
        args.signature,
        args.description))
      .wait();

    let proposalId = getEventData("AddProposal", dao, receipt).proposalId;
    console.log("ProposalId: " + proposalId)
  });

task("vote")
  .addParam("id", "proposal Id")
  .addParam("choice", "choice")
  .setAction(async (args, hre) => {
    const dao = (await hre.ethers.getContractAt("DAO", config.Dao));
    await dao.vote(args.id, args.choice)
  });

task("delegate")
  .addParam("id", "proposal Id")
  .addParam("to", "to address")
  .setAction(async (args, hre) => {
    const dao = (await hre.ethers.getContractAt("DAO", config.Dao));
    await dao.delegate(args.id, args.to)
  });

task("finishProposal")
  .addParam("id", "proposal Id")
  .setAction(async (args, hre) => {
    const dao = (await hre.ethers.getContractAt("DAO", config.Dao));
    await dao.finishProposal(args.id)
  });