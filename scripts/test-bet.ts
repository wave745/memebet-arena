import * as anchor from "@coral-xyz/anchor"
import { PublicKey, Connection } from "@solana/web3.js"
import { createRequire } from "module"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const require = createRequire(import.meta.url)

// Import program helpers
const programModule = require("../lib/anchor/program.ts")
const { getProgram, getPositionPda, getMarketPda, PROGRAM_ID } = programModule

// Test placing a bet on the first seeded market
async function testBet() {
  console.log("🎲 Testing bet placement on devnet...\n")

  // Use environment provider
  anchor.setProvider(anchor.AnchorProvider.env())
  const provider = anchor.getProvider()
  const connection = provider.connection
  const wallet = provider.wallet as anchor.Wallet

  console.log(`Program ID: ${PROGRAM_ID.toString()}`)
  console.log(`Wallet: ${wallet.publicKey.toString()}\n`)

  // Use the first market we seeded
  // Market 1: BONK $5B, end: 2026-06-30
  const tokenMint = new PublicKey("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263") // BONK
  const targetMarketCap = new anchor.BN(5_000_000_000)
  const endTimestamp = new anchor.BN(Math.floor(new Date("2026-06-30T23:59:59Z").getTime() / 1000))

  // Derive market PDA
  const [marketPda] = getMarketPda(tokenMint, targetMarketCap, endTimestamp)
  console.log(`Market PDA: ${marketPda.toString()}`)

  // Fetch market to verify it exists
  const program = getProgram(connection, wallet)
  try {
    const marketAccount = await program.account.market.fetch(marketPda)
    console.log(`Market found:`)
    console.log(`  Token: ${marketAccount.tokenMint.toString()}`)
    console.log(`  Target: $${marketAccount.targetMarketCap.toString()}`)
    console.log(`  End: ${new Date(Number(marketAccount.endTimestamp) * 1000).toISOString()}`)
    console.log(`  Resolved: ${marketAccount.resolved}`)
    console.log(`  YES Pool: ${marketAccount.yesPool.toString()} lamports`)
    console.log(`  NO Pool: ${marketAccount.noPool.toString()} lamports`)
  } catch (error) {
    console.error("Failed to fetch market:", error)
    process.exit(1)
  }

  // Place a bet
  const betAmount = 0.1 // 0.1 SOL
  const amountLamports = new anchor.BN(betAmount * anchor.web3.LAMPORTS_PER_SOL)
  const outcome = true // YES

  console.log(`\n💰 Placing bet:`)
  console.log(`  Amount: ${betAmount} SOL (${amountLamports.toString()} lamports)`)
  console.log(`  Outcome: ${outcome ? "YES" : "NO"}`)

  // Derive position PDA
  const [positionPda] = getPositionPda(marketPda, wallet.publicKey)
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

    // Verify the bet by fetching market again
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const updatedMarket = await program.account.market.fetch(marketPda)
    console.log(`\n📊 Updated market state:`)
    console.log(`  YES Pool: ${updatedMarket.yesPool.toString()} lamports`)
    console.log(`  NO Pool: ${updatedMarket.noPool.toString()} lamports`)

    // Fetch position
    const position = await program.account.position.fetch(positionPda)
    console.log(`\n📝 Position:`)
    console.log(`  User: ${position.user.toString()}`)
    console.log(`  Outcome: ${position.outcome ? "YES" : "NO"}`)
    console.log(`  Amount: ${position.amount.toString()} lamports`)
    console.log(`  Claimed: ${position.claimed}`)
  } catch (error: any) {
    console.error("\n❌ Bet failed:", error.message)
    if (error.logs) {
      console.error("Logs:", error.logs)
    }
    process.exit(1)
  }
}

testBet().catch(console.error)

