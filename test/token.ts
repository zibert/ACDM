import { ethers, waffle, web3, network } from 'hardhat'

import chai from 'chai'

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address"

import ACDMTokenArtifacts from '../artifacts/contracts/ACDMToken.sol/ACDMToken.json'
import { ACDMToken } from '../src/types/ACDMToken'

import XXXTokenArtifacts from '../artifacts/contracts/XXXToken.sol/XXXToken.json'
import { XXXToken } from '../src/types/XXXToken'

const { deployContract } = waffle
const { expect } = chai

import { BigNumber, Contract, ContractReceipt } from "ethers";

describe("ACDMPlatform - the first sales round test", function () {
    let acdmToken: ACDMToken;
    let xxxToken: XXXToken;
    let signers: SignerWithAddress[]

    let owner: SignerWithAddress;
    let acc1: SignerWithAddress;

    beforeEach(async () => {
        signers = await ethers.getSigners();

        owner = signers[0];
        acc1 = signers[1];

        acdmToken = (await deployContract(owner, ACDMTokenArtifacts)) as ACDMToken;
        xxxToken = (await deployContract(signers[0], XXXTokenArtifacts)) as XXXToken
    })

    it('change of owner by a non-owner must be reverted', async () => {
        await expect(xxxToken.connect(acc1).setOwner(acc1.address)).to.be.revertedWith(
            "only owner"
        );
    })

    it('set owner shoud be correct', async () => {
        expect(await xxxToken.balanceOf(owner.address)).to.eq(0);
        await xxxToken.setOwner(acc1.address);
        await xxxToken.connect(acc1).mint(owner.address, ethers.utils.parseEther("42"));
        expect(await xxxToken.balanceOf(owner.address)).to.eq(ethers.utils.parseEther("42"));
    })

    it('decimals shoud be correct', async () => {
        expect(await acdmToken.decimals()).to.eq(6);
    })

    it('mint by a non-owner must be reverted', async () => {
        await expect(acdmToken.connect(acc1).mint(acc1.address, 1)).to.be.revertedWith(
            "only platform"
        );
    })

    it('change of owner by a non-owner must be reverted', async () => {
        await expect(acdmToken.connect(acc1).setPlatform(acc1.address)).to.be.revertedWith(
            "only owner"
        );
    })
})