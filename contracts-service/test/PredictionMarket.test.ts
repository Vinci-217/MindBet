import { expect } from "chai";
import { ethers } from "hardhat";
import { PredictionMarket } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("PredictionMarket", function () {
  let market: PredictionMarket;
  let owner: HardhatEthersSigner;
  let creator: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let groupOwner: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;

  const CREATOR_DEPOSIT = ethers.parseEther("0.001");
  const MIN_BET_AMOUNT = ethers.parseEther("0.0001");
  const ONE_DAY = 24 * 60 * 60;

  beforeEach(async function () {
    [owner, creator, user1, user2, groupOwner, treasury] = await ethers.getSigners();

    const PredictionMarket = await ethers.getContractFactory("PredictionMarket");
    market = await PredictionMarket.deploy(await treasury.getAddress());
    await market.waitForDeployment();
  });

  describe("Market Creation", function () {
    it("Should create a market with correct parameters", async function () {
      const contentHash = ethers.keccak256(ethers.toUtf8Bytes("Test Market"));
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + ONE_DAY;

      await expect(market.connect(creator).createMarket(contentHash, deadline, await groupOwner.getAddress(), { value: CREATOR_DEPOSIT }))
        .to.emit(market, "MarketCreated")
        .withArgs(1, contentHash, deadline, await creator.getAddress(), await groupOwner.getAddress());

      const marketData = await market.getMarket(1);
      expect(marketData.id).to.equal(1);
      expect(marketData.contentHash).to.equal(contentHash);
      expect(marketData.deadline).to.equal(deadline);
      expect(marketData.creator).to.equal(await creator.getAddress());
      expect(marketData.groupOwner).to.equal(await groupOwner.getAddress());
      expect(marketData.status).to.equal(0);
    });

    it("Should deduct deposit from creator", async function () {
      const contentHash = ethers.keccak256(ethers.toUtf8Bytes("Test Market"));
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + ONE_DAY;

      const balanceBefore = await ethers.provider.getBalance(await creator.getAddress());
      const tx = await market.connect(creator).createMarket(contentHash, deadline, ethers.ZeroAddress, { value: CREATOR_DEPOSIT });
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(await creator.getAddress());

      expect(balanceBefore - balanceAfter).to.equal(CREATOR_DEPOSIT + gasUsed);
    });

    it("Should fail if deadline is in the past", async function () {
      const contentHash = ethers.keccak256(ethers.toUtf8Bytes("Test Market"));
      const pastDeadline = (await ethers.provider.getBlock("latest"))!.timestamp - 1;

      await expect(
        market.connect(creator).createMarket(contentHash, pastDeadline, ethers.ZeroAddress, { value: CREATOR_DEPOSIT })
      ).to.be.revertedWith("Deadline must be in future");
    });

    it("Should fail if deposit is insufficient", async function () {
      const contentHash = ethers.keccak256(ethers.toUtf8Bytes("Test Market"));
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + ONE_DAY;

      await expect(
        market.connect(creator).createMarket(contentHash, deadline, ethers.ZeroAddress, { value: ethers.parseEther("0.0001") })
      ).to.be.revertedWith("Insufficient deposit");
    });
  });

  describe("Placing Bets", function () {
    let marketId: bigint;
    let deadline: number;

    beforeEach(async function () {
      const contentHash = ethers.keccak256(ethers.toUtf8Bytes("Test Market"));
      deadline = (await ethers.provider.getBlock("latest"))!.timestamp + ONE_DAY;
      await market.connect(creator).createMarket(contentHash, deadline, await groupOwner.getAddress(), { value: CREATOR_DEPOSIT });
      marketId = 1n;
    });

    it("Should place a bet on YES", async function () {
      const betAmount = ethers.parseEther("0.01");

      await expect(market.connect(user1).placeBet(marketId, true, { value: betAmount }))
        .to.emit(market, "BetPlaced")
        .withArgs(marketId, await user1.getAddress(), true, betAmount, betAmount, 0);

      const bet = await market.getUserBet(marketId, await user1.getAddress());
      expect(bet.amount).to.equal(betAmount);
      expect(bet.betType).to.equal(true);
      expect(bet.claimed).to.equal(false);

      const marketData = await market.getMarket(marketId);
      expect(marketData.totalYesPool).to.equal(betAmount);
    });

    it("Should place a bet on NO", async function () {
      const betAmount = ethers.parseEther("0.01");

      await expect(market.connect(user1).placeBet(marketId, false, { value: betAmount }))
        .to.emit(market, "BetPlaced")
        .withArgs(marketId, await user1.getAddress(), false, betAmount, 0, betAmount);

      const marketData = await market.getMarket(marketId);
      expect(marketData.totalNoPool).to.equal(betAmount);
    });

    it("Should fail if bet amount is below minimum", async function () {
      const smallAmount = ethers.parseEther("0.00001");

      await expect(
        market.connect(user1).placeBet(marketId, true, { value: smallAmount })
      ).to.be.revertedWith("Amount below minimum");
    });

    it("Should fail if user tries to bet both sides", async function () {
      const betAmount = ethers.parseEther("0.01");

      await market.connect(user1).placeBet(marketId, true, { value: betAmount });

      await expect(
        market.connect(user1).placeBet(marketId, false, { value: betAmount })
      ).to.be.revertedWith("Cannot bet both sides");
    });

    it("Should close market when betting near deadline", async function () {
      const betAmount = ethers.parseEther("0.01");
      
      await ethers.provider.send("evm_increaseTime", [ONE_DAY - 1800]);
      await ethers.provider.send("evm_mine");

      await expect(market.connect(user1).placeBet(marketId, true, { value: betAmount }))
        .to.emit(market, "MarketClosed");

      const marketData = await market.getMarket(marketId);
      expect(marketData.status).to.equal(1);
    });
  });

  describe("Market Resolution", function () {
    let marketId: bigint;

    beforeEach(async function () {
      const contentHash = ethers.keccak256(ethers.toUtf8Bytes("Test Market"));
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + ONE_DAY;
      await market.connect(creator).createMarket(contentHash, deadline, await groupOwner.getAddress(), { value: CREATOR_DEPOSIT });
      marketId = 1n;

      await market.connect(user1).placeBet(marketId, true, { value: ethers.parseEther("0.01") });
      await market.connect(user2).placeBet(marketId, false, { value: ethers.parseEther("0.01") });

      await ethers.provider.send("evm_increaseTime", [ONE_DAY]);
      await ethers.provider.send("evm_mine");
    });

    it("Should resolve market with YES result", async function () {
      await expect(market.connect(owner).resolveMarket(marketId, 1))
        .to.emit(market, "MarketResolved");

      const marketData = await market.getMarket(marketId);
      expect(marketData.status).to.equal(2);
      expect(marketData.result).to.equal(1);
    });

    it("Should refund deposit to creator after resolution", async function () {
      const balanceBefore = await ethers.provider.getBalance(await creator.getAddress());
      
      await market.connect(owner).resolveMarket(marketId, 1);
      
      const balanceAfter = await ethers.provider.getBalance(await creator.getAddress());
      expect(balanceAfter - balanceBefore).to.equal(CREATOR_DEPOSIT);
    });

    it("Should fail if non-owner tries to resolve", async function () {
      await expect(
        market.connect(user1).resolveMarket(marketId, 1)
      ).to.be.reverted;
    });

    it("Should fail with invalid result", async function () {
      await expect(
        market.connect(owner).resolveMarket(marketId, 3)
      ).to.be.revertedWith("Invalid result");
    });
  });

  describe("Claiming Winnings", function () {
    let marketId: bigint;

    beforeEach(async function () {
      const contentHash = ethers.keccak256(ethers.toUtf8Bytes("Test Market"));
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + ONE_DAY;
      await market.connect(creator).createMarket(contentHash, deadline, await groupOwner.getAddress(), { value: CREATOR_DEPOSIT });
      marketId = 1n;

      await market.connect(user1).placeBet(marketId, true, { value: ethers.parseEther("0.01") });
      await market.connect(user2).placeBet(marketId, false, { value: ethers.parseEther("0.01") });

      await ethers.provider.send("evm_increaseTime", [ONE_DAY]);
      await ethers.provider.send("evm_mine");
      await market.connect(owner).resolveMarket(marketId, 1);
    });

    it("Should allow winner to claim", async function () {
      const balanceBefore = await ethers.provider.getBalance(await user1.getAddress());
      
      await expect(market.connect(user1).claim(marketId))
        .to.emit(market, "Claimed");

      const balanceAfter = await ethers.provider.getBalance(await user1.getAddress());
      expect(balanceAfter).to.be.gt(balanceBefore);

      const bet = await market.getUserBet(marketId, await user1.getAddress());
      expect(bet.claimed).to.equal(true);
    });

    it("Should fail if loser tries to claim", async function () {
      await expect(
        market.connect(user2).claim(marketId)
      ).to.be.revertedWith("Not a winner");
    });

    it("Should fail if already claimed", async function () {
      await market.connect(user1).claim(marketId);
      
      await expect(
        market.connect(user1).claim(marketId)
      ).to.be.revertedWith("Already claimed");
    });
  });

  describe("Market Cancellation", function () {
    let marketId: bigint;

    beforeEach(async function () {
      const contentHash = ethers.keccak256(ethers.toUtf8Bytes("Test Market"));
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + ONE_DAY;
      await market.connect(creator).createMarket(contentHash, deadline, await groupOwner.getAddress(), { value: CREATOR_DEPOSIT });
      marketId = 1n;

      await market.connect(user1).placeBet(marketId, true, { value: ethers.parseEther("0.01") });
    });

    it("Should cancel market and refund deposit", async function () {
      const balanceBefore = await ethers.provider.getBalance(await creator.getAddress());
      
      await expect(market.connect(owner).cancelMarket(marketId))
        .to.emit(market, "MarketCancelled");

      const marketData = await market.getMarket(marketId);
      expect(marketData.status).to.equal(3);

      const balanceAfter = await ethers.provider.getBalance(await creator.getAddress());
      expect(balanceAfter - balanceBefore).to.equal(CREATOR_DEPOSIT);
    });

    it("Should allow users to refund bets after cancellation", async function () {
      await market.connect(owner).cancelMarket(marketId);
      
      const balanceBefore = await ethers.provider.getBalance(await user1.getAddress());
      await market.connect(user1).refundCancelledBet(marketId);
      const balanceAfter = await ethers.provider.getBalance(await user1.getAddress());

      expect(balanceAfter).to.be.gt(balanceBefore);
    });
  });
});
