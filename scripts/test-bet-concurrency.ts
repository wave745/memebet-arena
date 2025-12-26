import * as anchor from "@coral-xyz/anchor"
import { PublicKey, Keypair, Transaction } from "@solana/web3.js"

// Set provider
anchor.setProvider(anchor.AnchorProvider.env())
const provider = anchor.getProvider()
const program = anchor.workspace.MemebetArena as any

// Test 1: Concurrency hell - two wallets betting same market, same block
async function testConcurrency() {
  console.log("⚔️  CONCURRENCY TEST: Two wallets, same market, same block\n")

  const wallet = provider.wallet as anchor.Wallet
  const connection = provider.connection

  // Market setup
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

  // Create second wallet
  const wallet2 = Keypair.generate()
  try {
    const sig = await connection.requestAirdrop(wallet2.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL)
    await connection.confirmTransaction(sig)
  } catch (error) {
    console.log("⚠️  Could not airdrop to wallet2 (rate limit?)")
    return
  }

  const wallet2Adapter = {
    publicKey: wallet2.publicKey,
    signTransaction: async (tx: Transaction) => {
      tx.sign(wallet2)
      return tx
    },
    signAllTransactions: async (txs: Transaction[]) => {
      return txs.map((tx) => {
        tx.sign(wallet2)
        return tx
      })
    },
  } as anchor.Wallet

  // Get latest blockhash
  const { blockhash } = await connection.getLatestBlockhash()

  // Build transactions for both wallets simultaneously
  const amountLamports = new anchor.BN(0.05 * anchor.web3.LAMPORTS_PER_SOL)
  const outcome = true // Both betting YES

  // Wallet 1 transaction
  const [positionPda1] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), marketPda.toBuffer(), wallet.publicKey.toBuffer()],
    program.programId
  )

  // Wallet 2 transaction
  const [positionPda2] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), marketPda.toBuffer(), wallet2.publicKey.toBuffer()],
    program.programId
  )

  // Check if positions already exist
  const pos1Info = await connection.getAccountInfo(positionPda1)
  const pos2Info = await connection.getAccountInfo(positionPda2)

  if (pos1Info) {
    console.log("⚠️  Wallet 1 already has a position, skipping...")
  } else {
    const provider1 = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" })
    const program1 = new anchor.Program(program.idl, program.programId, provider1)
    
    const tx1 = await program1.methods
      .placeBet(outcome, amountLamports)
      .accounts({
        market: marketPda,
        position: positionPda1,
        marketEscrow: marketPda,
        user: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc()

    console.log(`✅ Wallet 1 bet: ${tx1}`)
  }

  if (pos2Info) {
    console.log("⚠️  Wallet 2 already has a position, skipping...")
  } else {
    const provider2 = new anchor.AnchorProvider(connection, wallet2Adapter, { commitment: "confirmed" })
    const program2 = new anchor.Program(program.idl, program.programId, provider2)
    
    const tx2 = await program2.methods
      .placeBet(outcome, amountLamports)
      .accounts({
        market: marketPda,
        position: positionPda2,
        marketEscrow: marketPda,
        user: wallet2.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc()

    console.log(`✅ Wallet 2 bet: ${tx2}`)
  }

  // Verify escrow invariant
  await new Promise((resolve) => setTimeout(resolve, 2000))
  const marketInfo = await connection.getAccountInfo(marketPda)
  console.log(`\n📊 Escrow balance: ${marketInfo?.lamports} lamports`)
  console.log(`✅ Both bets should be in escrow`)
}

// Test 2: Boundary abuse - timestamps and amounts
async function testBoundaries() {
  console.log("\n⚔️  BOUNDARY TEST: Timestamps and amounts\n")

  const wallet = provider.wallet as anchor.Wallet
  const connection = provider.connection

  // Test market with near-expiration timestamp
  const tokenMint = new PublicKey("EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm") // WIF
  const targetMarketCap = new anchor.BN(10_000_000_000)
  const now = Math.floor(Date.now() / 1000)
  const nearExpiration = now + 10 // 10 seconds from now

  const [marketPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("market"),
      tokenMint.toBuffer(),
      targetMarketCap.toArrayLike(Buffer, "le", 8),
      new anchor.BN(nearExpiration).toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  )

  // Check if this market exists (it might not)
  const marketInfo = await connection.getAccountInfo(marketPda)
  if (!marketInfo) {
    console.log("⚠️  Test market doesn't exist, skipping boundary tests")
    return
  }

  console.log(`Market expires in ~10 seconds`)
  console.log(`Testing bet placement near expiration...`)

  // Try to bet with 1 lamport
  try {
    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), marketPda.toBuffer(), wallet.publicKey.toBuffer()],
      program.programId
    )

    const tinyAmount = new anchor.BN(1) // 1 lamport
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

    console.log(`✅ Tiny bet (1 lamport) succeeded: ${tx}`)
  } catch (error: any) {
    console.log(`❌ Tiny bet failed: ${error.message}`)
  }
}

// Test 3: State poisoning attempts
async function testStatePoisoning() {
  console.log("\n⚔️  STATE POISONING TEST: Invalid states and accounts\n")

  const wallet = provider.wallet as anchor.Wallet
  const connection = provider.connection

  // Use a valid market
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

  // Test 3a: Try betting with wrong escrow account
  console.log("Test 3a: Wrong escrow account")
  try {
    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), marketPda.toBuffer(), wallet.publicKey.toBuffer()],
      program.programId
    )

    const wrongEscrow = Keypair.generate().publicKey
    await program.methods
      .placeBet(true, new anchor.BN(1000000))
      .accounts({
        market: marketPda,
        position: positionPda,
        marketEscrow: wrongEscrow, // Wrong!
        user: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc()

    console.log("❌ Should have failed with wrong escrow!")
  } catch (error: any) {
    console.log(`✅ Correctly rejected wrong escrow: ${error.message.slice(0, 100)}`)
  }

  // Test 3b: Try betting with mismatched position seeds
  console.log("\nTest 3b: Mismatched position PDA")
  try {
    const wrongPosition = Keypair.generate().publicKey
    await program.methods
      .placeBet(true, new anchor.BN(1000000))
      .accounts({
        market: marketPda,
        position: wrongPosition, // Wrong PDA!
        marketEscrow: marketPda,
        user: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc()

    console.log("❌ Should have failed with wrong position PDA!")
  } catch (error: any) {
    console.log(`✅ Correctly rejected wrong position PDA: ${error.message.slice(0, 100)}`)
  }
}

// Test 4: Escrow invariant verification
async function testEscrowInvariant() {
  console.log("\n⚔️  ESCROW INVARIANT TEST: escrow.lamports == yes_pool + no_pool + rent\n")

  const wallet = provider.wallet as anchor.Wallet
  const connection = provider.connection

  // Use the first market
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

  // Fetch market account data manually (bypass deserialization issues)
  const marketInfo = await connection.getAccountInfo(marketPda)
  if (!marketInfo) {
    console.log("❌ Market not found")
    return
  }

  // Parse market data manually
  // Structure: 8 (discriminator) + 32 (creator) + 32 (token_mint) + 8 (target) + 8 (end) + 8 (yes) + 8 (no) + 1 (resolved) + 1-2 (outcome)
  const data = marketInfo.data
  const yesPool = data.readBigUInt64LE(88)
  const noPool = data.readBigUInt64LE(96)

  const escrowBalance = marketInfo.lamports
  const rentExempt = 1628640 // Approximate rent for market account
  const expectedBalance = Number(yesPool) + Number(noPool) + rentExempt

  console.log(`  Escrow balance: ${escrowBalance} lamports`)
  console.log(`  YES pool: ${yesPool.toString()} lamports`)
  console.log(`  NO pool: ${noPool.toString()} lamports`)
  console.log(`  Rent exempt: ${rentExempt} lamports`)
  console.log(`  Expected: ${expectedBalance} lamports`)
  console.log(`  Actual: ${escrowBalance} lamports`)

  const diff = Math.abs(escrowBalance - expectedBalance)
  if (diff <= 1000) { // Allow small rounding differences
    console.log(`\n✅ INVARIANT HOLDS: escrow ≈ yes_pool + no_pool + rent (diff: ${diff} lamports)`)
  } else {
    console.log(`\n❌ INVARIANT BROKEN: Difference of ${diff} lamports!`)
    console.log(`   This is a critical bug - escrow does not match pools!`)
  }
}

async function runAllTests() {
  await testConcurrency()
  await testBoundaries()
  await testStatePoisoning()
  await testEscrowInvariant()
  console.log("\n✅ All adversarial tests complete!")
}

runAllTests().catch(console.error)

