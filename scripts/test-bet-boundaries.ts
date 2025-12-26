import * as anchor from "@coral-xyz/anchor"
import { PublicKey } from "@solana/web3.js"

// Set provider
anchor.setProvider(anchor.AnchorProvider.env())
const provider = anchor.getProvider()
const program = anchor.workspace.MemebetArena as any

// Test boundary conditions: timestamps, amounts, resolved markets
async function testBoundaries() {
  console.log("⚔️  BOUNDARY ABUSE TEST: Timestamps, amounts, resolved markets\n")

  const wallet = provider.wallet as anchor.Wallet
  const connection = provider.connection

  // Use existing market
  const tokenMint = new PublicKey("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263")
  const targetMarketCap = new anchor.BN(5_000_000_000)
  const endTimestamp = new anchor.BN(Math.floor(new Date("2026-06-30T23:59:59Z").getTime() / 1000))
  const [marketPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("market"),
      tokenMint.toBuffer(),
      targetMarketCap.toArrayLike(Buffer, "le", 8),
      endTimestamp.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  )

  // Test 1: Bet with 1 lamport (minimum)
  console.log("Test 1: Minimum bet amount (1 lamport)")
  try {
    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), marketPda.toBuffer(), wallet.publicKey.toBuffer()],
      program.programId
    )

    const positionInfo = await connection.getAccountInfo(positionPda)
    if (positionInfo) {
      console.log("  ⚠️  Position already exists, cannot test")
    } else {
      const tinyAmount = new anchor.BN(1)
      const tx = await program.methods
        .placeBet(true, tinyAmount)
        .accounts({
          market: marketPda,
          position: positionPda,
          marketEscrow: marketPda,
          user: wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc()

      console.log(`  ✅ Minimum bet (1 lamport) succeeded: ${tx}`)
    }
  } catch (error: any) {
    console.log(`  ❌ Minimum bet failed: ${error.message.slice(0, 100)}`)
  }

  // Test 2: Bet with zero amount (should fail)
  console.log("\nTest 2: Zero amount (should fail)")
  try {
    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), marketPda.toBuffer(), wallet.publicKey.toBuffer()],
      program.programId
    )

    const zeroAmount = new anchor.BN(0)
    await program.methods
      .placeBet(true, zeroAmount)
      .accounts({
        market: marketPda,
        position: positionPda,
        marketEscrow: marketPda,
        user: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc()

    console.log("  ❌ Should have failed with zero amount!")
  } catch (error: any) {
    if (error.message.includes("InvalidBetAmount") || error.message.includes("amount > 0")) {
      console.log(`  ✅ Correctly rejected zero amount`)
    } else {
      console.log(`  ⚠️  Failed for different reason: ${error.message.slice(0, 100)}`)
    }
  }

  // Test 3: Try betting on resolved market (need to resolve first, then try)
  console.log("\nTest 3: Betting on resolved market")
  try {
    // First, try to resolve the market (if not already resolved)
    const marketInfo = await connection.getAccountInfo(marketPda)
    if (marketInfo) {
      const data = marketInfo.data
      const resolved = data[104] === 1
      
      if (!resolved) {
        // Try to resolve (will fail if not expired)
        try {
          await program.methods
            .resolveMarket(new anchor.BN(6_000_000_000)) // Above target
            .accounts({
              market: marketPda,
              resolver: wallet.publicKey,
            })
            .rpc()
          console.log("  ℹ️  Market resolved for testing")
        } catch (error: any) {
          console.log(`  ℹ️  Cannot resolve (market not expired): ${error.message.slice(0, 80)}`)
        }
      }

      // Now try to bet on resolved market
      const [positionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), marketPda.toBuffer(), wallet.publicKey.toBuffer()],
        program.programId
      )

      await program.methods
        .placeBet(true, new anchor.BN(1000000))
        .accounts({
          market: marketPda,
          position: positionPda,
          marketEscrow: marketPda,
          user: wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc()

      console.log("  ❌ Should have failed on resolved market!")
    }
  } catch (error: any) {
    if (error.message.includes("MarketResolved") || error.message.includes("resolved")) {
      console.log(`  ✅ Correctly rejected bet on resolved market`)
    } else {
      console.log(`  ⚠️  Failed for different reason: ${error.message.slice(0, 100)}`)
    }
  }

  // Test 4: Verify escrow invariant after boundary tests
  console.log("\nTest 4: Escrow invariant verification")
  const marketInfo = await connection.getAccountInfo(marketPda)
  if (marketInfo) {
    const data = marketInfo.data
    const yesPool = data.readBigUInt64LE(88)
    const noPool = data.readBigUInt64LE(96)
    const escrowBalance = marketInfo.lamports
    const rentExempt = 1628640
    const expected = Number(yesPool) + Number(noPool) + rentExempt
    const diff = Math.abs(escrowBalance - expected)

    console.log(`  Escrow: ${escrowBalance}, YES: ${yesPool}, NO: ${noPool}, Rent: ${rentExempt}`)
    if (diff <= 1000) {
      console.log(`  ✅ Invariant holds (diff: ${diff} lamports)`)
    } else {
      console.log(`  ❌ Invariant broken (diff: ${diff} lamports)`)
    }
  }

  console.log("\n✅ Boundary tests complete!")
}

testBoundaries().catch(console.error)

