import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram } from "@solana/web3.js"
import * as anchor from "@coral-xyz/anchor"
import { createRequire } from "module"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const require = createRequire(import.meta.url)

const PROGRAM_ID = new PublicKey("ACBgFwUQrHYhfHRWFTowCLGg7FKMnth4Pi7JgHndYvWL")
const RPC_URL = process.env.RPC_URL || "https://api.mainnet-beta.solana.com"
const WALLET_PATH = process.env.WALLET_PATH || "~/.config/solana/id.json"

interface MarketSeed {
  marketId: number
  tokenMint: string
  targetMarketCap: number
  endTimestamp: number
  description: string
}

const MARKETS: MarketSeed[] = [
  {
    marketId: 1,
    tokenMint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // BONK
    targetMarketCap: 5_000_000_000,
    endTimestamp: Math.floor(new Date("2026-06-30T23:59:59Z").getTime() / 1000),
    description: "Will $BONK reach $5B market cap by 2026-06-30 23:59 UTC?",
  },
  {
    marketId: 2,
    tokenMint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", // WIF
    targetMarketCap: 10_000_000_000,
    endTimestamp: Math.floor(new Date("2026-03-31T23:59:59Z").getTime() / 1000),
    description: "Will $WIF hit $10B market cap by 2026-03-31 23:59 UTC?",
  },
  {
    marketId: 3,
    tokenMint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", // POPCAT
    targetMarketCap: 2_000_000_000,
    endTimestamp: Math.floor(new Date("2026-01-31T23:59:59Z").getTime() / 1000),
    description: "Will $POPCAT reach $2B market cap by 2026-01-31 23:59 UTC?",
  },
]

function loadWallet(): Keypair {
  const fs = require("fs")
  const os = require("os")
  const walletPath = WALLET_PATH.replace("~", os.homedir())
  const keyData = JSON.parse(fs.readFileSync(walletPath, "utf-8"))
  return Keypair.fromSecretKey(Uint8Array.from(keyData))
}

function getMarketPda(marketId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("market"), new anchor.BN(marketId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  )
}

async function seedMarkets() {
  console.log("🌱 Seeding markets on mainnet...")
  console.log(`Program ID: ${PROGRAM_ID.toString()}`)
  console.log(`RPC: ${RPC_URL}\n`)

  const connection = new Connection(RPC_URL, "confirmed")
  const wallet = loadWallet()

  console.log(`Wallet: ${wallet.publicKey.toString()}`)
  const balance = await connection.getBalance(wallet.publicKey)
  console.log(`Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`)

  if (balance < 2 * LAMPORTS_PER_SOL) {
    console.error("❌ Insufficient balance. Need at least 2 SOL for seeding.")
    process.exit(1)
  }

  // Load IDL to get instruction discriminators
  const idlPath = join(__dirname, "../target/idl/memebet_arena.json")
  const idl = require(idlPath)
  const createMarketIx = idl.instructions.find((ix: any) => ix.name === "create_market")
  const discriminator = Buffer.from(createMarketIx.discriminator)

  for (const market of MARKETS) {
    try {
      console.log(`\n📊 Creating market ${market.marketId}: ${market.description}`)
      
      const [marketPda] = getMarketPda(market.marketId)
      const tokenMintPubkey = new PublicKey(market.tokenMint)
      
      // Use anchor.BN directly
      const targetMarketCapBN = new anchor.BN(market.targetMarketCap)
      const endTimestampBN = new anchor.BN(market.endTimestamp)
      const marketIdBN = new anchor.BN(market.marketId)

      console.log(`  Market PDA: ${marketPda.toString()}`)
      console.log(`  Token: ${tokenMintPubkey.toString()}`)
      console.log(`  Target: $${market.targetMarketCap.toLocaleString()}`)
      console.log(`  End: ${new Date(market.endTimestamp * 1000).toISOString()}`)

      // Build instruction data manually
      const instructionData = Buffer.concat([
        discriminator,
        marketIdBN.toArrayLike(Buffer, "le", 8),
        tokenMintPubkey.toBuffer(),
        targetMarketCapBN.toArrayLike(Buffer, "le", 8),
        endTimestampBN.toArrayLike(Buffer, "le", 8),
      ])

      // For PDA accounts, we need to use invoke_signed or let Anchor handle it
      // Since we're doing raw transaction, we need the program to sign for the PDA
      // Actually, let's use Anchor's program API but with a workaround for the IDL issue
      const walletAdapter = {
        publicKey: wallet.publicKey,
        signTransaction: async (tx: Transaction) => {
          tx.sign(wallet)
          return tx
        },
        signAllTransactions: async (txs: Transaction[]) => {
          return txs.map((tx) => {
            tx.sign(wallet)
            return tx
          })
        },
      }
      
      const provider = new anchor.AnchorProvider(
        connection,
        walletAdapter as any,
        { commitment: "confirmed" }
      )
      
      // Use a minimal IDL structure that works
      const minimalIdl = {
        version: "0.1.0",
        name: "memebet_arena",
        instructions: [createMarketIx],
        accounts: [],
        types: [],
        errors: [],
        metadata: { address: PROGRAM_ID.toString() }
      }
      
      const program = new anchor.Program(minimalIdl as any, provider) as any
      
      // IDL uses snake_case: create_market, but Anchor converts to camelCase
      // Try both just in case
      const methodName = "createMarket" in program.methods ? "createMarket" : "create_market"
      const signature = await (program.methods as any)[methodName](
        marketIdBN,
        tokenMintPubkey,
        targetMarketCapBN,
        endTimestampBN
      )
        .accounts({
          market: marketPda,
          creator: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      await connection.confirmTransaction(signature, "confirmed")

      console.log(`  ✅ Created! Signature: ${signature}`)
      console.log(`  🔗 https://solscan.io/tx/${signature}?cluster=mainnet`)
      
      await new Promise((resolve) => setTimeout(resolve, 2000))
    } catch (error: any) {
      console.error(`  ❌ Failed to create market ${market.marketId}:`, error.message)
      if (error.logs) {
        console.error("  Logs:", error.logs)
      }
    }
  }

  console.log("\n✅ Market seeding complete!")
}

seedMarkets().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})

