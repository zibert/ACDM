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

const { deployContract } = waffle
const { expect } = chai

import { BigNumber, Contract, ContractReceipt } from "ethers";

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

describe("ACDMPlatform - the first sales round test", function () {
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

    beforeEach(async () => {
        signers = await ethers.getSigners();

        owner = signers[0];
        acc1 = signers[1];
        acc2 = signers[2];
        acc3 = signers[3];
        chairPerson = signers[4];

        acdmToken = (await deployContract(owner, ACDMTokenArtifacts)) as ACDMToken;

        lptoken = (await deployContract(signers[0], XXXTokenArtifacts)) as XXXToken
        xxxToken = (await deployContract(signers[0], XXXTokenArtifacts)) as XXXToken
        staking = (await deployContract(signers[0], StakingArtifacts, [lptoken.address, xxxToken.address])) as Staking

        dao = (await deployContract(signers[0], DAOArtifacts,
            [chairPerson.address, staking.address, ethers.utils.parseEther("10.0"), 3600 * 24 * 3])) as DAO;

        acdmPlatform = (await deployContract(owner, ACDMPlatformArtifacts,
            [acdmToken.address, dao.address, xxxToken.address])) as ACDMPlatform;

        await acdmToken.setPlatform(acdmPlatform.address);
    })

    it('dual registration should be rejected', async () => {
        await acdmPlatform.register(acc1.address);
        await expect(acdmPlatform.register(acc1.address)).to.be.revertedWith(
            "already registered"
        );
    })

    it('self-registration  should be rejected', async () => {
        await expect(acdmPlatform.register(owner.address)).to.be.revertedWith(
            "such registration is prohibited"
        );
    })

    it('registration to a zero address is prohibited', async () => {
        await expect(acdmPlatform.register("0x0000000000000000000000000000000000000000")).to.be.revertedWith(
            "incorrect address"
        );
    })

    it('buyACDM is only after startFirstSaleRound', async () => {
        await expect(acdmPlatform.buyACDM()).to.be.revertedWith(
            "the first sale round isn't stated"
        );
    })

    it('the second launch of the first sales round must be prohibited', async () => {
        await acdmPlatform.startFirstSaleRound();
        await expect(acdmPlatform.startFirstSaleRound()).to.be.revertedWith(
            "already started"
        );
    })

    it('the launch of the first sales round must be correct', async () => {
        expect((await acdmToken.balanceOf(acdmPlatform.address))).to.eq(0)
        expect((await acdmPlatform.acdmPrice())).to.eq(0)
        expect((await acdmPlatform.acdmTokens())).to.eq(0)

        await acdmPlatform.startFirstSaleRound();

        expect((await acdmToken.balanceOf(acdmPlatform.address))).to.eq(ethers.utils.parseUnits("100000", "6"))
        expect((await acdmPlatform.acdmPrice())).to.eq(10000000000000)
        expect((await acdmPlatform.acdmTokens())).to.eq(100000)
    })

    it('buyACDM for zero ethers must be rejected', async () => {
        await acdmPlatform.startFirstSaleRound();
        await expect(acdmPlatform.buyACDM()).to.be.revertedWith(
            "no ethers has been sent"
        );
    })

    it('buying too many ACDM tokens must be rejected', async () => {
        await acdmPlatform.startFirstSaleRound();
        await expect(acdmPlatform.buyACDM({ value: ethers.utils.parseEther("2.0") })).to.be.revertedWith(
            "not enough tokens to sale"
        );
    })

    it('buyACDM should be correct', async () => {
        await acdmPlatform.startFirstSaleRound();
        let price = await acdmPlatform.acdmPrice();
        expect((await acdmToken.balanceOf(owner.address))).to.eq(0)

        const voteTx = await acdmPlatform.buyACDM({ value: price.mul(1000) })
        await expect(() => voteTx).to.changeEtherBalance(owner, price.mul(-1000))
        await expect(() => voteTx).to.changeEtherBalance(acdmPlatform, price.mul(1000))
        expect((await acdmToken.balanceOf(acdmPlatform.address))).to.eq(ethers.utils.parseUnits("99000", "6"))
        expect((await acdmToken.balanceOf(owner.address))).to.eq(ethers.utils.parseUnits("1000", "6"))
    })

    it('buyACDM  with one referral must be correct', async () => {
        await acdmPlatform.startFirstSaleRound();
        await acdmPlatform.register(acc1.address);
        let price = await acdmPlatform.acdmPrice();

        const voteTx = await acdmPlatform.buyACDM({ value: price.mul(1000) })
        await expect(() => voteTx).to.changeEtherBalance(owner, price.mul(-1000))
        await expect(() => voteTx).to.changeEtherBalance(acdmPlatform, price.mul(950))
        await expect(() => voteTx).to.changeEtherBalance(acc1, price.mul(50))
    })

    it('buyACDM  with two referral2 must be correct', async () => {
        await acdmPlatform.startFirstSaleRound();
        await acdmPlatform.register(acc1.address);
        await acdmPlatform.connect(acc1).register(acc2.address);
        let price = await acdmPlatform.acdmPrice();

        const voteTx = await acdmPlatform.buyACDM({ value: price.mul(1000) })
        await expect(() => voteTx).to.changeEtherBalance(owner, price.mul(-1000))
        await expect(() => voteTx).to.changeEtherBalance(acdmPlatform, price.mul(920))
        await expect(() => voteTx).to.changeEtherBalance(acc1, price.mul(50))
        await expect(() => voteTx).to.changeEtherBalance(acc2, price.mul(30))
    })

    it('startTradeRound must be rejectedif a sales round is in progress', async () => {
        await acdmPlatform.startFirstSaleRound();
        let price = await acdmPlatform.acdmPrice();
        await acdmPlatform.buyACDM({ value: price.mul(1000) })
        await acdmToken.approve(acdmPlatform.address, ethers.utils.parseUnits("100.0", "6"))
        await expect(acdmPlatform.startTradeRound()).to.be.revertedWith(
            "sale round in progress"
        );
        await expect(acdmPlatform.addOrder(ethers.utils.parseUnits("100.0", "6"), price.add(price.div(10)))).to.be.revertedWith(
            "not a trade round"
        );
    })

    it('startTradeRound should be possible if all tokens are sold out', async () => {
        await acdmPlatform.startFirstSaleRound();
        let price = await acdmPlatform.acdmPrice();
        let tokens = await acdmPlatform.acdmTokens();
        await acdmPlatform.buyACDM({ value: price.mul(tokens) })
        await acdmPlatform.startTradeRound();
        await acdmToken.approve(acdmPlatform.address, ethers.utils.parseUnits("100.0", "6"))

        const receipt = await (
            await acdmPlatform.addOrder(100, price.add(price.div(10))))
            .wait();

        expect(getEventData("AddOrder", acdmPlatform, receipt).id).to.eq(0)
        expect(getEventData("AddOrder", acdmPlatform, receipt).amount).to.eq(100)
        expect(getEventData("AddOrder", acdmPlatform, receipt).tokenPriceInEther).to.eq(price.add(price.div(10)))
    })

    it('startTradeRound should be possible should be possible after a given period', async () => {
        await acdmPlatform.startFirstSaleRound();
        let price = await acdmPlatform.acdmPrice();
        let tokens = await acdmPlatform.acdmTokens();
        await acdmPlatform.buyACDM({ value: price.mul(tokens.div(2)) })

        await network.provider.send("evm_increaseTime", [3600 * 24 * 3 + 1])
        await network.provider.send("evm_mine");

        expect(await acdmToken.balanceOf(acdmPlatform.address)).to.eq(ethers.utils.parseUnits("50000.0", "6"))

        await acdmPlatform.startTradeRound();

        expect(await acdmToken.balanceOf(acdmPlatform.address)).to.eq(0)

        await acdmToken.approve(acdmPlatform.address, ethers.utils.parseUnits("100.0", "6"))
        const receipt = await (
            await acdmPlatform.addOrder(100, price.add(price.div(10))))
            .wait();

        expect(getEventData("AddOrder", acdmPlatform, receipt).id).to.eq(0)
        expect(getEventData("AddOrder", acdmPlatform, receipt).amount).to.eq(100)
        expect(getEventData("AddOrder", acdmPlatform, receipt).tokenPriceInEther).to.eq(price.add(price.div(10)))
    })
});

describe("ACDMPlatform - trade round test", function () {
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

    beforeEach(async () => {
        signers = await ethers.getSigners();

        owner = signers[0];
        acc1 = signers[1];
        acc2 = signers[2];
        acc3 = signers[3];
        chairPerson = signers[4];

        acdmToken = (await deployContract(owner, ACDMTokenArtifacts)) as ACDMToken;

        lptoken = (await deployContract(signers[0], XXXTokenArtifacts)) as XXXToken
        xxxToken = (await deployContract(signers[0], XXXTokenArtifacts)) as XXXToken
        staking = (await deployContract(signers[0], StakingArtifacts, [lptoken.address, xxxToken.address])) as Staking

        dao = (await deployContract(signers[0], DAOArtifacts,
            [chairPerson.address, staking.address, ethers.utils.parseEther("10.0"), 3600 * 24 * 3])) as DAO;

        acdmPlatform = (await deployContract(owner, ACDMPlatformArtifacts,
            [acdmToken.address, dao.address, xxxToken.address])) as ACDMPlatform;

        await acdmToken.setPlatform(acdmPlatform.address);
        await acdmPlatform.startFirstSaleRound();
        let price = await acdmPlatform.acdmPrice();
        let tokens = await acdmPlatform.acdmTokens();
        await acdmPlatform.buyACDM({ value: price.mul(tokens.div(2)) })

        await network.provider.send("evm_increaseTime", [3600 * 24 * 3 + 1])
        await network.provider.send("evm_mine");
        await acdmPlatform.startTradeRound();
    })

    it('addOrder should be correct', async () => {
        expect(await acdmToken.balanceOf(owner.address)).to.eq(ethers.utils.parseUnits("50000.0", "6"))
        await acdmToken.approve(acdmPlatform.address, ethers.utils.parseUnits("50000.0", "6"))

        const receipt = await (
            await acdmPlatform.addOrder(100, ethers.utils.parseEther("0.0000014")))
            .wait();

        expect(await acdmToken.balanceOf(acdmPlatform.address)).to.eq(ethers.utils.parseUnits("100.0", "6"))
        expect(await acdmToken.balanceOf(owner.address)).to.eq(ethers.utils.parseUnits("49900.0", "6"))

        expect(getEventData("AddOrder", acdmPlatform, receipt).id).to.eq(0)
        expect(getEventData("AddOrder", acdmPlatform, receipt).amount).to.eq(100)
        expect(getEventData("AddOrder", acdmPlatform, receipt).tokenPriceInEther)
            .to.eq(ethers.utils.parseEther("0.0000014"))
    })

    it('removeOrder should be correct', async () => {
        expect(await acdmToken.balanceOf(owner.address)).to.eq(ethers.utils.parseUnits("50000.0", "6"))
        await acdmToken.approve(acdmPlatform.address, ethers.utils.parseUnits("50000.0", "6"))

        await acdmPlatform.addOrder(100, ethers.utils.parseEther("0.0000014"))

        expect(await acdmToken.balanceOf(acdmPlatform.address)).to.eq(ethers.utils.parseUnits("100.0", "6"))
        expect(await acdmToken.balanceOf(owner.address)).to.eq(ethers.utils.parseUnits("49900.0", "6"))

        await acdmPlatform.removeOrder(0)

        expect(await acdmToken.balanceOf(acdmPlatform.address)).to.eq(0)
        expect(await acdmToken.balanceOf(owner.address)).to.eq(ethers.utils.parseUnits("50000.0", "6"))
    })

    it('buy should be reverted if not enough ethers', async () => {
        expect(await acdmToken.balanceOf(owner.address)).to.eq(ethers.utils.parseUnits("50000.0", "6"))
        await acdmToken.approve(acdmPlatform.address, ethers.utils.parseUnits("50000.0", "6"))

        await acdmPlatform.addOrder(100, ethers.utils.parseEther("0.0000014"))

        await expect(acdmPlatform.buy(0, 42)).to.be.revertedWith(
            "not enough ethers"
        );
    })

    it('buy should be reverted if not enough ethers', async () => {
        expect(await acdmToken.balanceOf(owner.address)).to.eq(ethers.utils.parseUnits("50000.0", "6"))
        await acdmToken.approve(acdmPlatform.address, ethers.utils.parseUnits("50000.0", "6"))

        await acdmPlatform.addOrder(100, ethers.utils.parseEther("0.0000014"))

        await expect(acdmPlatform.buy(0, 200,
            {
                value: ethers.utils.parseEther("0.0000014").mul(200)
            })).to.be.revertedWith(
                "not enough tokens"
            );
    })

    it('buy should be correct', async () => {
        expect(await acdmToken.balanceOf(owner.address)).to.eq(ethers.utils.parseUnits("50000.0", "6"))
        await acdmToken.approve(acdmPlatform.address, ethers.utils.parseUnits("50000.0", "6"))
        await acdmPlatform.addOrder(100, ethers.utils.parseEther("0.0000014"))

        const voteTx = await acdmPlatform.connect(acc1).buy(0, 42, { value: ethers.utils.parseEther("0.0000014").mul(42) });
        await expect(() => voteTx).to.changeEtherBalance(owner,
            ethers.utils.parseEther("0.0000014").mul(42).mul(95).div(100))
        await expect(() => voteTx).to.changeEtherBalance(acdmPlatform,
            ethers.utils.parseEther("0.0000014").mul(42).mul(5).div(100));
    })

    it('startSaleRound in trade round should be reverted', async () => {
        await expect(acdmPlatform.startSaleRound()).to.be.revertedWith(
            "trade round in progress"
        );
    })

    it('buy event should be correct', async () => {
        expect(await acdmToken.balanceOf(owner.address)).to.eq(ethers.utils.parseUnits("50000.0", "6"))
        await acdmToken.approve(acdmPlatform.address, ethers.utils.parseUnits("50000.0", "6"))
        await acdmPlatform.addOrder(100, ethers.utils.parseEther("0.0000014"))

        const receipt = await (
            await acdmPlatform.connect(acc1).buy(0, 42, { value: ethers.utils.parseEther("0.0000014").mul(42) }))
            .wait();

        expect(getEventData("ChangeOrder", acdmPlatform, receipt).id).to.eq(0)
        expect(getEventData("ChangeOrder", acdmPlatform, receipt).reduction).to.eq(42)
    })

    it('buy with one referral should be correct', async () => {
        expect(await acdmToken.balanceOf(owner.address)).to.eq(ethers.utils.parseUnits("50000.0", "6"))
        await acdmToken.approve(acdmPlatform.address, ethers.utils.parseUnits("50000.0", "6"))
        await acdmPlatform.addOrder(100, ethers.utils.parseEther("0.0000014"))

        await acdmPlatform.register(acc2.address)

        const voteTx = await acdmPlatform.connect(acc1).buy(0, 42, { value: ethers.utils.parseEther("0.0000014").mul(42) });
        await expect(() => voteTx).to.changeEtherBalance(owner,
            ethers.utils.parseEther("0.0000014").mul(42).mul(95).div(100))
        await expect(() => voteTx).to.changeEtherBalance(acdmPlatform,
            ethers.utils.parseEther("0.0000014").mul(42).mul(25).div(1000));
        await expect(() => voteTx).to.changeEtherBalance(acc2,
            ethers.utils.parseEther("0.0000014").mul(42).mul(25).div(1000));
    })

    it('buy with two referrals should be correct', async () => {
        expect(await acdmToken.balanceOf(owner.address)).to.eq(ethers.utils.parseUnits("50000.0", "6"))
        await acdmToken.approve(acdmPlatform.address, ethers.utils.parseUnits("50000.0", "6"))
        await acdmPlatform.addOrder(100, ethers.utils.parseEther("0.0000014"))

        await acdmPlatform.register(acc2.address)
        await acdmPlatform.connect(acc2).register(acc3.address)

        const voteTx = await acdmPlatform.connect(acc1).buy(0, 42, { value: ethers.utils.parseEther("0.0000014").mul(42) });
        await expect(() => voteTx).to.changeEtherBalance(owner,
            ethers.utils.parseEther("0.0000014").mul(42).mul(95).div(100))
        await expect(() => voteTx).to.changeEtherBalance(acdmPlatform, 0);
        await expect(() => voteTx).to.changeEtherBalance(acc2,
            ethers.utils.parseEther("0.0000014").mul(42).mul(25).div(1000));
        await expect(() => voteTx).to.changeEtherBalance(acc3,
            ethers.utils.parseEther("0.0000014").mul(42).mul(25).div(1000));
    })

    it('removing the other persons order must be rejected', async () => {
        await acdmToken.approve(acdmPlatform.address, ethers.utils.parseUnits("50000.0", "6"))
        await acdmPlatform.addOrder(100, ethers.utils.parseEther("0.0000014"))

        await expect(acdmPlatform.connect(acc1).removeOrder(0)).to.be.revertedWith(
            "not a owner"
        );
    })

    it('buyACDM should be reverted in trade round', async () => {
        await expect(acdmPlatform.buyACDM()).to.be.revertedWith(
            "not a sale round"
        );
    })
});

describe("ACDMPlatform - new sale round test", function () {
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

    beforeEach(async () => {
        signers = await ethers.getSigners();

        owner = signers[0];
        acc1 = signers[1];
        acc2 = signers[2];
        acc3 = signers[3];
        chairPerson = signers[4];

        acdmToken = (await deployContract(owner, ACDMTokenArtifacts)) as ACDMToken;

        lptoken = (await deployContract(signers[0], XXXTokenArtifacts)) as XXXToken
        xxxToken = (await deployContract(signers[0], XXXTokenArtifacts)) as XXXToken
        staking = (await deployContract(signers[0], StakingArtifacts, [lptoken.address, xxxToken.address])) as Staking

        dao = (await deployContract(signers[0], DAOArtifacts,
            [chairPerson.address, staking.address, ethers.utils.parseEther("10.0"), 3600 * 24 * 3])) as DAO;

        acdmPlatform = (await deployContract(owner, ACDMPlatformArtifacts,
            [acdmToken.address, dao.address, xxxToken.address])) as ACDMPlatform;

        await acdmToken.setPlatform(acdmPlatform.address);
        await acdmPlatform.startFirstSaleRound();
    })

    it('new sale round test', async () => {
        let price = await acdmPlatform.acdmPrice();
        await acdmPlatform.buyACDM({ value: price.mul(50000) });

        await network.provider.send("evm_increaseTime", [3600 * 24 * 3 + 1])
        await network.provider.send("evm_mine");

        await acdmPlatform.startTradeRound();
        await acdmToken.approve(acdmPlatform.address, ethers.utils.parseUnits("50000", "6"))

        const receipt = await (
            await acdmPlatform.addOrder(50000, price.mul(105).div(100)))
            .wait();

        let userPrice = BigNumber.from(getEventData("AddOrder", acdmPlatform, receipt).tokenPriceInEther);

        await acdmPlatform.connect(acc1).buy(0, 50000, { value: userPrice.mul(50000) })

        await network.provider.send("evm_increaseTime", [3600 * 24 * 3 + 1])
        await network.provider.send("evm_mine");

        expect((await acdmToken.balanceOf(acdmPlatform.address))).to.eq(0)

        await acdmPlatform.startSaleRound();

        expect((await acdmToken.balanceOf(acdmPlatform.address)))
            .to.eq(userPrice.mul(50000).div(price).mul(1000000))
        expect((await acdmPlatform.acdmPrice()))
            .to.eq(price.mul(103).div(100).add(ethers.utils.parseEther("0.000004")))
        expect((await acdmPlatform.acdmTokens()))
            .to.eq(userPrice.mul(50000).div(price))
    })
});
