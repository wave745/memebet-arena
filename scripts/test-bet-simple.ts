import * as anchor from "@coral-xyz/anchor"
import { PublicKey } from "@solana/web3.js"
import BN from "bn.js"

// Set provider
anchor.setProvider(anchor.AnchorProvider.env())
const provider = anchor.getProvider()
const program = anchor.workspace.MemebetArena as any

async function testBet() {
  console.log("🎲 Testing bet placement on devnet...\n")

  const wallet = provider.wallet as anchor.Wallet
  console.log(`Program ID: ${program.programId.toString()}`)
  console.log(`Wallet: ${wallet.publicKey.toString()}\n`)

  // Use the first market we seeded
  const tokenMint = new PublicKey("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263") // BONK
  const targetMarketCap = new BN(5_000_000_000)
  const endTimestamp = new BN(Math.floor(new Date("2026-06-30T23:59:59Z").getTime() / 1000))

  // Derive market PDA
  const seeds = [
    Buffer.from("market"),
    tokenMint.toBuffer(),
    targetMarketCap.toArrayLike(Buffer, "le", 8),
    endTimestamp.toArrayLike(Buffer, "le", 8),
  ]
  const [marketPda] = PublicKey.findProgramAddressSync(seeds, program.programId)
  console.log(`Market PDA: ${marketPda.toString()}`)

  // Check if market account exists (don't deserialize - existing markets have old encoding)
  const connection = provider.connection
  const accountInfo = await connection.getAccountInfo(marketPda)
  if (!accountInfo) {
    console.error("Market account does not exist!")
    process.exit(1)
  }
  console.log(`Market account exists (${accountInfo.lamports} lamports, ${accountInfo.data.length} bytes)`)

  // Place a bet
  const betAmount = 0.1 // 0.1 SOL
  const amountLamports = new BN(betAmount * anchor.web3.LAMPORTS_PER_SOL)
  const outcome = true // YES

  console.log(`\n💰 Placing bet:`)
  console.log(`  Amount: ${betAmount} SOL (${amountLamports.toString()} lamports)`)
  console.log(`  Outcome: ${outcome ? "YES" : "NO"}`)

  // Derive position PDA
  const [positionPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), marketPda.toBuffer(), wallet.publicKey.toBuffer()],
    program.programId
  )
  console.log(`  Position PDA: ${positionPda.toString()}`)

  try {
    const tx = await program.methods
      .placeBet(outcome, amountLamports)
      .accounts({
        market: marketPda,
        position: positionPda,
        marketEscrow: marketPda, // Market PDA is the escrow
        user: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc()

    console.log(`\n✅ Bet placed successfully!`)
    console.log(`Transaction: ${tx}`)
    console.log(`Solscan: https://solscan.io/tx/${tx}?cluster=devnet`)

    // Verify the bet by checking account balances
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const updatedAccountInfo = await connection.getAccountInfo(marketPda)
    console.log(`\n📊 Updated market account:`)
    console.log(`  Balance: ${updatedAccountInfo?.lamports} lamports`)
    
    // Try to fetch position (this should work)
    try {
      const position = await program.account.position.fetch(positionPda)
      console.log(`\n📝 Position:`)
      console.log(`  User: ${position.user.toString()}`)
      console.log(`  Outcome: ${position.outcome ? "YES" : "NO"}`)
      console.log(`  Amount: ${position.amount.toString()} lamports`)
      console.log(`  Claimed: ${position.claimed}`)
    } catch (error) {
      console.log(`\n⚠️  Could not deserialize position (may need to wait for confirmation)`)
    }
  } catch (error: any) {
    console.error("\n❌ Bet failed:", error.message)
    if (error.logs) {
      console.error("Logs:", error.logs)
    }
    process.exit(1)
  }
}

testBet().catch(console.error)

