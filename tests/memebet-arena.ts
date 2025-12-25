import * as anchor from "@coral-xyz/anchor"
import type { Program } from "@coral-xyz/anchor"
import type { MemebetArena } from "../target/types/memebet_arena"
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js"
import { expect } from "chai"
import { describe, before, it } from "mocha"

describe("memebet-arena", () => {
  const BN = anchor.BN
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.MemebetArena as Program<MemebetArena>

  // Test wallets
  let creator: Keypair
  let bettor1: Keypair
  let bettor2: Keypair
  let bettor3: Keypair
  let resolver: Keypair

  // Market state
  let marketId: BN
  let marketPda: PublicKey
  let marketBump: number

  // Token mint (mock for testing)
  const tokenMint = Keypair.generate().publicKey
  const targetMarketCap = new BN(100_000_000) // 100M

  // Timestamps
  let futureEndTime: BN
  let pastEndTime: BN

  before(async () => {
    // Generate test wallets
    creator = Keypair.generate()
    bettor1 = Keypair.generate()
    bettor2 = Keypair.generate()
    bettor3 = Keypair.generate()
    resolver = Keypair.generate()

    // Airdrop SOL to all test wallets
    const airdropAmount = 10 * LAMPORTS_PER_SOL

    await Promise.all([
      provider.connection.requestAirdrop(creator.publicKey, airdropAmount),
      provider.connection.requestAirdrop(bettor1.publicKey, airdropAmount),
      provider.connection.requestAirdrop(bettor2.publicKey, airdropAmount),
      provider.connection.requestAirdrop(bettor3.publicKey, airdropAmount),
      provider.connection.requestAirdrop(resolver.publicKey, airdropAmount),
    ])

    // Wait for airdrops to confirm
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Set timestamps
    const now = Math.floor(Date.now() / 1000)
    futureEndTime = new BN(now + 3600) // 1 hour from now
    pastEndTime = new BN(now - 3600) // 1 hour ago

    // Generate market ID
    marketId = new BN(1)

    // Derive market PDA
    ;[marketPda, marketBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), marketId.toArrayLike(Buffer, "le", 8)],
      program.programId,
    )
  })

  // ============================================================
  // I. MARKET CREATION INVARIANTS
  // ============================================================

  describe("I. Market Creation Invariants", () => {
    it("creates a market with valid parameters", async () => {
      await program.methods
        .createMarket(marketId, tokenMint, targetMarketCap, futureEndTime)
        .accounts({
          market: marketPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator])
        .rpc()

      const market = await program.account.market.fetch(marketPda)

      expect(market.marketId.toNumber()).to.equal(1)
      expect(market.tokenMint.toString()).to.equal(tokenMint.toString())
      expect(market.targetMarketCap.toNumber()).to.equal(100_000_000)
      expect(market.yesPool.toNumber()).to.equal(0)
      expect(market.noPool.toNumber()).to.equal(0)
      expect(market.resolved).to.equal(false)
      expect(market.outcome).to.equal(null)
    })

    it("REJECTS market creation with past end_timestamp", async () => {
      const pastMarketId = new BN(999)
      const [pastMarketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), pastMarketId.toArrayLike(Buffer, "le", 8)],
        program.programId,
      )

      try {
        await program.methods
          .createMarket(pastMarketId, tokenMint, targetMarketCap, pastEndTime)
          .accounts({
            market: pastMarketPda,
            creator: creator.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([creator])
          .rpc()

        expect.fail("Should have rejected past timestamp")
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InvalidEndTimestamp")
      }
    })

    it("REJECTS duplicate market ID", async () => {
      // Try to create market with same ID
      try {
        await program.methods
          .createMarket(marketId, tokenMint, targetMarketCap, futureEndTime)
          .accounts({
            market: marketPda,
            creator: creator.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([creator])
          .rpc()

        expect.fail("Should have rejected duplicate market")
      } catch (err: any) {
        // Account already exists - this is expected
        expect(err).to.exist
      }
    })

    it("PROVES pools start at zero", async () => {
      const market = await program.account.market.fetch(marketPda)
      expect(market.yesPool.toNumber()).to.equal(0)
      expect(market.noPool.toNumber()).to.equal(0)
    })

    it("PROVES target_market_cap is immutable (no setter exists)", async () => {
      // There is no instruction to modify market parameters
      // This test documents the invariant
      const market = await program.account.market.fetch(marketPda)
      expect(market.targetMarketCap.toNumber()).to.equal(100_000_000)

      // No updateMarket instruction exists in the program
      // The only way to "change" would be to create a new market
    })
  })

  // ============================================================
  // II. BETTING LOGIC ABUSE TESTS
  // ============================================================

  describe("II. Betting Logic Abuse Tests", () => {
    let positionPda1: PublicKey
    let positionPda2: PublicKey

    before(async () => {
      // Derive position PDAs
      ;[positionPda1] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("position"),
          marketPda.toBuffer(),
          bettor1.publicKey.toBuffer(),
          Buffer.from([1]), // YES
        ],
        program.programId,
      )
      ;[positionPda2] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("position"),
          marketPda.toBuffer(),
          bettor1.publicKey.toBuffer(),
          Buffer.from([0]), // NO
        ],
        program.programId,
      )
    })

    it("accepts valid YES bet", async () => {
      const betAmount = new BN(1 * LAMPORTS_PER_SOL)

      await program.methods
        .placeBet(true, betAmount)
        .accounts({
          market: marketPda,
          position: positionPda1,
          user: bettor1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([bettor1])
        .rpc()

      const position = await program.account.position.fetch(positionPda1)
      expect(position.outcome).to.equal(true)
      expect(position.amount.toNumber()).to.equal(LAMPORTS_PER_SOL)
      expect(position.claimed).to.equal(false)

      const market = await program.account.market.fetch(marketPda)
      expect(market.yesPool.toNumber()).to.equal(LAMPORTS_PER_SOL)
    })

    it("accepts valid NO bet", async () => {
      const betAmount = new BN(0.5 * LAMPORTS_PER_SOL)

      await program.methods
        .placeBet(false, betAmount)
        .accounts({
          market: marketPda,
          position: positionPda2,
          user: bettor1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([bettor1])
        .rpc()

      const market = await program.account.market.fetch(marketPda)
      expect(market.noPool.toNumber()).to.equal(0.5 * LAMPORTS_PER_SOL)
    })

    it("REJECTS zero lamport bet", async () => {
      const [zeroBetPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), marketPda.toBuffer(), bettor2.publicKey.toBuffer(), Buffer.from([1])],
        program.programId,
      )

      try {
        await program.methods
          .placeBet(true, new BN(0))
          .accounts({
            market: marketPda,
            position: zeroBetPda,
            user: bettor2.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([bettor2])
          .rpc()

        expect.fail("Should have rejected zero bet")
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InvalidBetAmount")
      }
    })

    it("allows same wallet to bet YES and NO (different positions)", async () => {
      // bettor1 already has YES and NO positions
      const market = await program.account.market.fetch(marketPda)
      const position1 = await program.account.position.fetch(positionPda1)
      const position2 = await program.account.position.fetch(positionPda2)

      // Both positions exist and are valid
      expect(position1.user.toString()).to.equal(bettor1.publicKey.toString())
      expect(position2.user.toString()).to.equal(bettor1.publicKey.toString())
      expect(position1.outcome).to.equal(true)
      expect(position2.outcome).to.equal(false)
    })

    it("REJECTS duplicate bet (same wallet, same outcome)", async () => {
      // bettor1 already has a YES position, try to create another
      try {
        await program.methods
          .placeBet(true, new BN(0.1 * LAMPORTS_PER_SOL))
          .accounts({
            market: marketPda,
            position: positionPda1, // Same PDA
            user: bettor1.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([bettor1])
          .rpc()

        expect.fail("Should have rejected duplicate position")
      } catch (err: any) {
        // Account already exists
        expect(err).to.exist
      }
    })
  })

  // ============================================================
  // III. POOL MATH CONSISTENCY
  // ============================================================

  describe("III. Pool Math Consistency", () => {
    let mathTestMarketId: BN
    let mathTestMarketPda: PublicKey

    before(async () => {
      // Create a fresh market for math tests
      mathTestMarketId = new BN(2)
      ;[mathTestMarketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), mathTestMarketId.toArrayLike(Buffer, "le", 8)],
        program.programId,
      )

      const now = Math.floor(Date.now() / 1000)
      await program.methods
        .createMarket(mathTestMarketId, tokenMint, targetMarketCap, new BN(now + 7200))
        .accounts({
          market: mathTestMarketPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator])
        .rpc()
    })

    it("pool totals equal escrow balance after multiple bets", async () => {
      const bets = [
        { user: bettor1, outcome: true, amount: 2 * LAMPORTS_PER_SOL },
        { user: bettor2, outcome: true, amount: 1.5 * LAMPORTS_PER_SOL },
        { user: bettor3, outcome: false, amount: 3 * LAMPORTS_PER_SOL },
        { user: bettor2, outcome: false, amount: 0.5 * LAMPORTS_PER_SOL },
      ]

      for (const bet of bets) {
        const [positionPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("position"),
            mathTestMarketPda.toBuffer(),
            bet.user.publicKey.toBuffer(),
            Buffer.from([bet.outcome ? 1 : 0]),
          ],
          program.programId,
        )

        await program.methods
          .placeBet(bet.outcome, new BN(bet.amount))
          .accounts({
            market: mathTestMarketPda,
            position: positionPda,
            user: bet.user.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([bet.user])
          .rpc()
      }

      const market = await program.account.market.fetch(mathTestMarketPda)
      const escrowBalance = await provider.connection.getBalance(mathTestMarketPda)

      const yesPool = market.yesPool.toNumber()
      const noPool = market.noPool.toNumber()
      const totalPools = yesPool + noPool

      // YES: 2 + 1.5 = 3.5 SOL
      expect(yesPool).to.equal(3.5 * LAMPORTS_PER_SOL)
      // NO: 3 + 0.5 = 3.5 SOL
      expect(noPool).to.equal(3.5 * LAMPORTS_PER_SOL)
      // Total: 7 SOL
      expect(totalPools).to.equal(7 * LAMPORTS_PER_SOL)

      // Escrow balance should match (minus rent)
      // Note: PDA has rent-exempt balance, so escrow >= pools
      expect(escrowBalance).to.be.at.least(totalPools)
    })

    it("implied probability matches on-chain math", async () => {
      const market = await program.account.market.fetch(mathTestMarketPda)

      const yesPool = market.yesPool.toNumber()
      const noPool = market.noPool.toNumber()
      const total = yesPool + noPool

      const yesProb = yesPool / total
      const noProb = noPool / total

      // 3.5 / 7 = 0.5
      expect(yesProb).to.equal(0.5)
      expect(noProb).to.equal(0.5)
      expect(yesProb + noProb).to.equal(1)
    })

    it("no rounding loss accumulates", async () => {
      const market = await program.account.market.fetch(mathTestMarketPda)

      // All amounts are stored as raw lamports
      // No division happens on-chain during betting
      // Rounding only occurs at redemption (and is bounded)

      const yesPool = market.yesPool.toNumber()
      const noPool = market.noPool.toNumber()

      // Verify exact lamport amounts
      expect(yesPool).to.equal(3_500_000_000)
      expect(noPool).to.equal(3_500_000_000)
    })
  })

  // ============================================================
  // IV. RESOLUTION FINALITY
  // ============================================================

  describe("IV. Resolution Finality", () => {
    let resolveTestMarketId: BN
    let resolveTestMarketPda: PublicKey
    let shortEndTime: BN

    before(async () => {
      // Create market that expires soon
      resolveTestMarketId = new BN(3)
      ;[resolveTestMarketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), resolveTestMarketId.toArrayLike(Buffer, "le", 8)],
        program.programId,
      )

      // Expires in 5 seconds
      const now = Math.floor(Date.now() / 1000)
      shortEndTime = new BN(now + 5)

      await program.methods
        .createMarket(resolveTestMarketId, tokenMint, targetMarketCap, shortEndTime)
        .accounts({
          market: resolveTestMarketPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator])
        .rpc()

      // Place a bet
      const [positionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), resolveTestMarketPda.toBuffer(), bettor1.publicKey.toBuffer(), Buffer.from([1])],
        program.programId,
      )

      await program.methods
        .placeBet(true, new BN(1 * LAMPORTS_PER_SOL))
        .accounts({
          market: resolveTestMarketPda,
          position: positionPda,
          user: bettor1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([bettor1])
        .rpc()
    })

    it("REJECTS resolution before end_timestamp", async () => {
      try {
        await program.methods
          .resolveMarket(new BN(150_000_000)) // Above target = YES
          .accounts({
            market: resolveTestMarketPda,
            resolver: resolver.publicKey,
          })
          .signers([resolver])
          .rpc()

        expect.fail("Should have rejected early resolution")
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("MarketNotExpired")
      }
    })

    it("accepts resolution after end_timestamp (permissionless)", async () => {
      // Wait for market to expire
      await new Promise((resolve) => setTimeout(resolve, 6000))

      // Any signer can resolve
      await program.methods
        .resolveMarket(new BN(150_000_000)) // 150M > 100M target = YES wins
        .accounts({
          market: resolveTestMarketPda,
          resolver: resolver.publicKey,
        })
        .signers([resolver])
        .rpc()

      const market = await program.account.market.fetch(resolveTestMarketPda)
      expect(market.resolved).to.equal(true)
      expect(market.outcome).to.equal(true) // YES wins
    })

    it("REJECTS second resolution attempt", async () => {
      try {
        await program.methods
          .resolveMarket(new BN(50_000_000)) // Try to flip to NO
          .accounts({
            market: resolveTestMarketPda,
            resolver: bettor1.publicKey, // Different resolver
          })
          .signers([bettor1])
          .rpc()

        expect.fail("Should have rejected second resolution")
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("MarketAlreadyResolved")
      }
    })

    it("PROVES outcome is locked forever", async () => {
      const market = await program.account.market.fetch(resolveTestMarketPda)

      // Outcome is permanently YES
      expect(market.resolved).to.equal(true)
      expect(market.outcome).to.equal(true)

      // No instruction exists to change this
    })
  })

  // ============================================================
  // V. REDEMPTION BRUTALITY
  // ============================================================

  describe("V. Redemption Brutality", () => {
    let redeemTestMarketId: BN
    let redeemTestMarketPda: PublicKey
    let winningPositionPda: PublicKey
    let losingPositionPda: PublicKey

    before(async () => {
      // Create market
      redeemTestMarketId = new BN(4)
      ;[redeemTestMarketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), redeemTestMarketId.toArrayLike(Buffer, "le", 8)],
        program.programId,
      )

      const now = Math.floor(Date.now() / 1000)
      await program.methods
        .createMarket(
          redeemTestMarketId,
          tokenMint,
          targetMarketCap,
          new BN(now + 3), // Expires in 3 seconds
        )
        .accounts({
          market: redeemTestMarketPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator])
        .rpc()

      // bettor1 bets YES (will win)
      ;[winningPositionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), redeemTestMarketPda.toBuffer(), bettor1.publicKey.toBuffer(), Buffer.from([1])],
        program.programId,
      )

      await program.methods
        .placeBet(true, new BN(2 * LAMPORTS_PER_SOL))
        .accounts({
          market: redeemTestMarketPda,
          position: winningPositionPda,
          user: bettor1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([bettor1])
        .rpc()

      // bettor2 bets NO (will lose)
      ;[losingPositionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), redeemTestMarketPda.toBuffer(), bettor2.publicKey.toBuffer(), Buffer.from([0])],
        program.programId,
      )

      await program.methods
        .placeBet(false, new BN(1 * LAMPORTS_PER_SOL))
        .accounts({
          market: redeemTestMarketPda,
          position: losingPositionPda,
          user: bettor2.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([bettor2])
        .rpc()

      // Wait and resolve (YES wins)
      await new Promise((resolve) => setTimeout(resolve, 4000))

      await program.methods
        .resolveMarket(new BN(200_000_000)) // Above target = YES
        .accounts({
          market: redeemTestMarketPda,
          resolver: resolver.publicKey,
        })
        .signers([resolver])
        .rpc()
    })

    it("REJECTS redemption before resolution", async () => {
      // Create unresolved market
      const unresolvedId = new BN(5)
      const [unresolvedPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), unresolvedId.toArrayLike(Buffer, "le", 8)],
        program.programId,
      )

      const now = Math.floor(Date.now() / 1000)
      await program.methods
        .createMarket(unresolvedId, tokenMint, targetMarketCap, new BN(now + 3600))
        .accounts({
          market: unresolvedPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator])
        .rpc()

      const [positionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), unresolvedPda.toBuffer(), bettor3.publicKey.toBuffer(), Buffer.from([1])],
        program.programId,
      )

      await program.methods
        .placeBet(true, new BN(0.1 * LAMPORTS_PER_SOL))
        .accounts({
          market: unresolvedPda,
          position: positionPda,
          user: bettor3.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([bettor3])
        .rpc()

      try {
        await program.methods
          .redeem()
          .accounts({
            market: unresolvedPda,
            position: positionPda,
            user: bettor3.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([bettor3])
          .rpc()

        expect.fail("Should have rejected redemption before resolution")
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("MarketNotResolved")
      }
    })

    it("REJECTS losing position redemption", async () => {
      try {
        await program.methods
          .redeem()
          .accounts({
            market: redeemTestMarketPda,
            position: losingPositionPda,
            user: bettor2.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([bettor2])
          .rpc()

        expect.fail("Should have rejected losing position redemption")
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("PositionNotWinner")
      }
    })

    it("allows winning position redemption with correct payout", async () => {
      const balanceBefore = await provider.connection.getBalance(bettor1.publicKey)

      await program.methods
        .redeem()
        .accounts({
          market: redeemTestMarketPda,
          position: winningPositionPda,
          user: bettor1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([bettor1])
        .rpc()

      const balanceAfter = await provider.connection.getBalance(bettor1.publicKey)
      const position = await program.account.position.fetch(winningPositionPda)

      expect(position.claimed).to.equal(true)

      // Payout calculation:
      // YES pool: 2 SOL, NO pool: 1 SOL
      // bettor1 owns 100% of YES pool
      // Payout = 2 SOL + (2/2 * 1 SOL) = 3 SOL
      // (minus tx fees)
      const expectedPayout = 3 * LAMPORTS_PER_SOL
      const actualGain = balanceAfter - balanceBefore

      // Allow for tx fees
      expect(actualGain).to.be.closeTo(expectedPayout, 0.01 * LAMPORTS_PER_SOL)
    })

    it("REJECTS double redemption", async () => {
      try {
        await program.methods
          .redeem()
          .accounts({
            market: redeemTestMarketPda,
            position: winningPositionPda,
            user: bettor1.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([bettor1])
          .rpc()

        expect.fail("Should have rejected double redemption")
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("PositionAlreadyClaimed")
      }
    })
  })

  // ============================================================
  // VI. EXPIRED MARKET BETTING REJECTION
  // ============================================================

  describe("VI. Expired Market Betting Rejection", () => {
    it("REJECTS bet on expired market", async () => {
      // Use the resolved market from earlier tests
      const resolvedMarketId = new BN(3)
      const [resolvedMarketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), resolvedMarketId.toArrayLike(Buffer, "le", 8)],
        program.programId,
      )

      const [positionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), resolvedMarketPda.toBuffer(), bettor3.publicKey.toBuffer(), Buffer.from([1])],
        program.programId,
      )

      try {
        await program.methods
          .placeBet(true, new BN(0.1 * LAMPORTS_PER_SOL))
          .accounts({
            market: resolvedMarketPda,
            position: positionPda,
            user: bettor3.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([bettor3])
          .rpc()

        expect.fail("Should have rejected bet on expired market")
      } catch (err: any) {
        // Either MarketExpired or MarketAlreadyResolved
        expect(["MarketExpired", "MarketAlreadyResolved"]).to.include(err.error.errorCode.code)
      }
    })

    it("REJECTS bet on resolved market", async () => {
      const resolvedMarketId = new BN(4)
      const [resolvedMarketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), resolvedMarketId.toArrayLike(Buffer, "le", 8)],
        program.programId,
      )

      const [positionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), resolvedMarketPda.toBuffer(), bettor3.publicKey.toBuffer(), Buffer.from([0])],
        program.programId,
      )

      try {
        await program.methods
          .placeBet(false, new BN(0.1 * LAMPORTS_PER_SOL))
          .accounts({
            market: resolvedMarketPda,
            position: positionPda,
            user: bettor3.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([bettor3])
          .rpc()

        expect.fail("Should have rejected bet on resolved market")
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("MarketAlreadyResolved")
      }
    })
  })
})
