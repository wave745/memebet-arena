import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { PublicKey } from "@solana/web3.js"
import type { MemebetArena } from "../target/types/memebet_arena"

// Set provider from environment (mainnet)
anchor.setProvider(anchor.AnchorProvider.env())

// Use workspace program with full types - this handles BN serialization correctly
const program = anchor.workspace.MemebetArena as Program<MemebetArena>

interface MarketSeed {
  tokenMint: string
  targetMarketCap: number
  endTimestamp: number
  description: string
}

const MARKETS: MarketSeed[] = [
  {
    tokenMint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // BONK
    targetMarketCap: 5_000_000_000, // $5B
    endTimestamp: Math.floor(new Date("2026-06-30T23:59:59Z").getTime() / 1000),
    description: "Will $BONK reach $5B market cap by 2026-06-30 23:59 UTC?",
  },
  {
    tokenMint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", // WIF
    targetMarketCap: 10_000_000_000, // $10B
    endTimestamp: Math.floor(new Date("2026-03-31T23:59:59Z").getTime() / 1000),
    description: "Will $WIF hit $10B market cap by 2026-03-31 23:59 UTC?",
  },
  {
    tokenMint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", // POPCAT
    targetMarketCap: 2_000_000_000, // $2B
    endTimestamp: Math.floor(new Date("2026-01-31T23:59:59Z").getTime() / 1000),
    description: "Will $POPCAT reach $2B market cap by 2026-01-31 23:59 UTC?",
  },
  {
    tokenMint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // BONK (different target)
    targetMarketCap: 3_000_000_000, // $3B
    endTimestamp: Math.floor(new Date("2026-05-31T23:59:59Z").getTime() / 1000),
    description: "Will $BONK reach $3B market cap by 2026-05-31 23:59 UTC?",
  },
  {
    tokenMint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", // WIF (different target)
    targetMarketCap: 8_000_000_000, // $8B
    endTimestamp: Math.floor(new Date("2026-04-30T23:59:59Z").getTime() / 1000),
    description: "Will $WIF hit $8B market cap by 2026-04-30 23:59 UTC?",
  },
]

async function seedMarkets() {
  console.log("🌱 Seeding markets on mainnet...")
  console.log(`Program ID: ${program.programId.toString()}`)
  console.log(`Provider: ${anchor.getProvider().connection.rpcEndpoint}\n`)

  const wallet = (anchor.getProvider().wallet as any).payer || anchor.getProvider().wallet
  console.log(`Wallet: ${wallet.publicKey.toString()}`)
  
  const balance = await anchor.getProvider().connection.getBalance(wallet.publicKey)
  console.log(`Balance: ${(balance / anchor.web3.LAMPORTS_PER_SOL).toFixed(4)} SOL\n`)

  if (balance < 2 * anchor.web3.LAMPORTS_PER_SOL) {
    console.error("❌ Insufficient balance. Need at least 2 SOL for seeding.")
    process.exit(1)
  }

  for (const market of MARKETS) {
    try {
      console.log(`\n📊 Creating market: ${market.description}`)
      
      const tokenMintPubkey = new PublicKey(market.tokenMint)
      const targetMarketCapBN = new anchor.BN(market.targetMarketCap)
      const endTimestampBN = new anchor.BN(market.endTimestamp)
      
      // Derive market PDA: [b"market", token_mint, target_market_cap, end_timestamp]
      const seeds = [
        Buffer.from("market"),
        tokenMintPubkey.toBuffer(),
        targetMarketCapBN.toArrayLike(Buffer, "le", 8),
        endTimestampBN.toArrayLike(Buffer, "le", 8),
      ]
      
      const [marketPda, bump] = PublicKey.findProgramAddressSync(seeds, program.programId)

      console.log(`  Market PDA: ${marketPda.toString()}`)
      console.log(`  Bump: ${bump}`)
      console.log(`  Token: ${tokenMintPubkey.toString()}`)
      console.log(`  Target: $${market.targetMarketCap.toLocaleString()}`)
      console.log(`  End: ${new Date(market.endTimestamp * 1000).toISOString()}`)

      // Pass explicit bump - Anchor will auto-sign PDA via program
      const txSig = await program.methods
        .createMarket(
          tokenMintPubkey,
          targetMarketCapBN,
          endTimestampBN,
          bump  // Explicit bump parameter
        )
        .accounts({
          market: marketPda,
          creator: wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as any)
        .signers([])
        .rpc()

      console.log(`  ✅ Created! Signature: ${txSig}`)
      console.log(`  🔗 https://solscan.io/tx/${txSig}?cluster=mainnet`)
      
      // Wait between transactions
      await new Promise((resolve) => setTimeout(resolve, 2000))
    } catch (error: any) {
      console.error(`  ❌ Failed to create market:`, error.message)
      if (error.logs) {
        console.error("  Logs:", error.logs)
      }
      // Continue with next market
    }
  }

  console.log("\n✅ Market seeding complete!")
}

seedMarkets().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
