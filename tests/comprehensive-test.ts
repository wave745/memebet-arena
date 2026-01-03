import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { MemeBetArena } from "../target/types/memebet_arena";
import { expect } from "chai";

describe("Comprehensive Secure PDA Architecture Test", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.memebetArena as Program<MemeBetArena>;
  const admin = provider.wallet;

  // Test data
  const tokenMint = new PublicKey("So11111111111111111111111111111111111111112"); // Wrapped SOL
  const targetMarketCap = 1000000; // 1M
  const endTimestamp = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now

  let treasuryPDA: PublicKey;
  let marketPDA: PublicKey;
  let vaultPDA: PublicKey;
  let positionPDA: PublicKey;

  before(async () => {
    // Derive PDAs
    [treasuryPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury")],
      program.programId
    );

    const marketSeeds = [
      Buffer.from("market"),
      tokenMint.toBuffer(),
      Buffer.from(targetMarketCap.toString()),
      Buffer.from(endTimestamp.toString())
    ];
    [marketPDA] = PublicKey.findProgramAddressSync(marketSeeds, program.programId);

    const vaultSeeds = [
      Buffer.from("vault"),
      tokenMint.toBuffer(),
      Buffer.from(targetMarketCap.toString()),
      Buffer.from(endTimestamp.toString())
    ];
    [vaultPDA] = PublicKey.findProgramAddressSync(vaultSeeds, program.programId);
  });

  it("Initialize treasury PDA", async () => {
    console.log("🏦 Initializing Treasury PDA:", treasuryPDA.toString());

    const tx = await program.methods
      .initializeTreasury()
      .accounts({
        treasury: treasuryPDA,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Treasury initialized. Tx:", tx);

    // Verify treasury account
    const treasuryAccount = await program.account.treasury.fetch(treasuryPDA);
    console.log("📊 Treasury state:", {
      admin: treasuryAccount.admin.toString(),
      totalFees: treasuryAccount.totalFeesCollected.toString(),
      lastWithdrawal: new Date(treasuryAccount.lastWithdrawal.toNumber() * 1000).toISOString()
    });

    expect(treasuryAccount.admin.toString()).to.equal(admin.publicKey.toString());
    expect(treasuryAccount.totalFeesCollected.toString()).to.equal("0");
  });

  it("Create market with isolated vault", async () => {
    console.log("📈 Creating Market PDA:", marketPDA.toString());
    console.log("🏦 Market Vault PDA:", vaultPDA.toString());

    const tx = await program.methods
      .createMarket(
        tokenMint,
        new anchor.BN(targetMarketCap),
        new anchor.BN(endTimestamp),
        Array.from(marketPDA.toBytes().slice(-1)), // bump
        Array.from(vaultPDA.toBytes().slice(-1))   // bump
      )
      .accounts({
        market: marketPDA,
        marketVault: vaultPDA,
        creator: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Market created. Tx:", tx);

    // Verify market account
    const marketAccount = await program.account.market.fetch(marketPDA);
    console.log("📊 Market state:", {
      creator: marketAccount.creator.toString(),
      tokenMint: marketAccount.tokenMint.toString(),
      targetMarketCap: marketAccount.targetMarketCap.toString(),
      endTimestamp: new Date(marketAccount.endTimestamp.toNumber() * 1000).toISOString(),
      yesPool: marketAccount.yesPool.toString(),
      noPool: marketAccount.noPool.toString(),
      resolved: marketAccount.resolved
    });

    expect(marketAccount.creator.toString()).to.equal(admin.publicKey.toString());
    expect(marketAccount.tokenMint.toString()).to.equal(tokenMint.toString());
    expect(marketAccount.targetMarketCap.toString()).to.equal(targetMarketCap.toString());
  });

  it("Place bet using vault PDA", async () => {
    const betAmount = LAMPORTS_PER_SOL * 0.1; // 0.1 SOL
    const outcome = true; // YES bet

    // Derive position PDA
    const positionSeeds = [
      Buffer.from("position"),
      marketPDA.toBuffer(),
      admin.publicKey.toBuffer(),
      Buffer.from([outcome ? 1 : 0])
    ];
    [positionPDA] = PublicKey.findProgramAddressSync(positionSeeds, program.programId);

    console.log("💰 Placing bet. Amount:", betAmount / LAMPORTS_PER_SOL, "SOL");
    console.log("🎯 Position PDA:", positionPDA.toString());

    const tx = await program.methods
      .placeBet(outcome, new anchor.BN(betAmount))
      .accounts({
        market: marketPDA,
        position: positionPDA,
        marketEscrow: vaultPDA, // Uses vault PDA
        user: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Bet placed. Tx:", tx);

    // Verify position
    const positionAccount = await program.account.position.fetch(positionPDA);
    console.log("📊 Position state:", {
      market: positionAccount.market.toString(),
      user: positionAccount.user.toString(),
      outcome: positionAccount.outcome,
      amount: positionAccount.amount.toString(),
      claimed: positionAccount.claimed
    });

    expect(positionAccount.market.toString()).to.equal(marketPDA.toString());
    expect(positionAccount.user.toString()).to.equal(admin.publicKey.toString());
    expect(positionAccount.outcome).to.equal(outcome);
    expect(positionAccount.amount.toString()).to.equal(betAmount.toString());

    // Verify market pools updated
    const marketAccount = await program.account.market.fetch(marketPDA);
    console.log("📊 Updated market pools:", {
      yesPool: marketAccount.yesPool.toString(),
      noPool: marketAccount.noPool.toString()
    });

    if (outcome) {
      expect(marketAccount.yesPool.toString()).to.equal(betAmount.toString());
      expect(marketAccount.noPool.toString()).to.equal("0");
    }
  });

  it("Test sell shares with treasury fees", async () => {
    // Get current market state
    let marketAccount = await program.account.market.fetch(marketPDA);
    console.log("📊 Before sell - Market pools:", {
      yesPool: marketAccount.yesPool.toString(),
      noPool: marketAccount.noPool.toString()
    });

    const amountToSell = LAMPORTS_PER_SOL * 0.05; // Sell 0.05 SOL worth
    const outcome = true;

    console.log("💸 Selling shares. Amount:", amountToSell / LAMPORTS_PER_SOL, "SOL");

    const tx = await program.methods
      .sellShares(outcome, new anchor.BN(amountToSell))
      .accounts({
        market: marketPDA,
        marketVault: vaultPDA,
        treasury: treasuryPDA,
        position: positionPDA,
        user: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Shares sold. Tx:", tx);

    // Verify position updated
    const positionAccount = await program.account.position.fetch(positionPDA);
    console.log("📊 Updated position:", {
      amount: positionAccount.amount.toString()
    });

    // Verify treasury received fees
    const treasuryAccount = await program.account.treasury.fetch(treasuryPDA);
    console.log("💰 Treasury fees collected:", treasuryAccount.totalFeesCollected.toString());

    expect(treasuryAccount.totalFeesCollected.toString()).to.not.equal("0");
  });

  it("Test unlimited treasury withdrawal", async () => {
    const treasuryAccountBefore = await program.account.treasury.fetch(treasuryPDA);
    const withdrawAmount = treasuryAccountBefore.totalFeesCollected.toNumber();

    console.log("💸 Withdrawing from treasury. Amount:", withdrawAmount, "lamports");

    const tx = await program.methods
      .withdrawFromTreasury(new anchor.BN(withdrawAmount))
      .accounts({
        treasury: treasuryPDA,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Treasury withdrawal complete. Tx:", tx);

    // Verify treasury updated
    const treasuryAccountAfter = await program.account.treasury.fetch(treasuryPDA);
    console.log("📊 Treasury after withdrawal:", {
      totalFees: treasuryAccountAfter.totalFeesCollected.toString(),
      lastWithdrawal: new Date(treasuryAccountAfter.lastWithdrawal.toNumber() * 1000).toISOString()
    });

    expect(treasuryAccountAfter.totalFeesCollected.toString()).to.equal("0");
  });

  it("Verify vault isolation - funds are ring-fenced", async () => {
    // Check vault balance
    const vaultBalance = await provider.connection.getBalance(vaultPDA);
    console.log("🏦 Vault PDA balance:", vaultBalance / LAMPORTS_PER_SOL, "SOL");

    // Vault should have funds from bets minus sold shares and fees
    expect(vaultBalance).to.be.greaterThan(0);

    // Treasury should be empty after withdrawal
    const treasuryBalance = await provider.connection.getBalance(treasuryPDA);
    console.log("🏛️ Treasury PDA balance:", treasuryBalance / LAMPORTS_PER_SOL, "SOL");

    // Treasury PDA should only have rent exemption
    const rent = await provider.connection.getMinimumBalanceForRentExemption(0);
    expect(treasuryBalance).to.equal(rent);
  });
});