import { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js"
import * as anchor from "@coral-xyz/anchor"
import { createRequire } from "module"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const require = createRequire(import.meta.url)

const PROGRAM_ID = new PublicKey("G3ctDAx46fPX4cTZgzcgzW1rDCe7e8qCqhCUTSf3a7LP")
const RPC_URL = process.env.RPC_URL || "https://api.mainnet-beta.solana.com"
const WALLET_PATH = process.env.WALLET_PATH || "~/.config/solana/id.json"

// Handle BN import issue
//@ts-ignore
const BN = anchor.BN || (anchor.default && anchor.default.BN);
if (!BN) {
  throw new Error("Could not find BN in anchor import");
}

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
    endTimestamp: Math.floor(new Date("2026-05-31T23:59:59Z").getTime() / 1000),
    description: "Will $POPCAT reach $2B market cap by 2026-05-31 23:59 UTC?",
  },
]

function loadWallet(): Keypair {
  const fs = require("fs")
  const os = require("os")
  const walletPath = WALLET_PATH.replace("~", os.homedir())
  const keyData = JSON.parse(fs.readFileSync(walletPath, "utf-8"))
  return Keypair.fromSecretKey(Uint8Array.from(keyData))
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

  // Define provider
  const provider = new anchor.AnchorProvider(
    connection,
    {
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
    } as any,
    { commitment: "confirmed" }
  )

  // Load IDL to get instruction discriminator
  const idlPath = join(__dirname, "../lib/anchor/idl.json")
  const idl = require(idlPath)
  const createMarketIx = idl.instructions.find((ix: any) => ix.name === "create_market")
  const discriminator = Buffer.from(createMarketIx.discriminator)

  for (const market of MARKETS) {
    try {
      console.log(`\n📊 Creating market ${market.marketId}: ${market.description}`)
      
      const tokenMintPubkey = new PublicKey(market.tokenMint)
      const targetMarketCapBN = new BN(market.targetMarketCap)
      const endTimestampBN = new BN(market.endTimestamp)

      const [marketPda, marketBump] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("market"),
          tokenMintPubkey.toBuffer(),
          targetMarketCapBN.toArrayLike(Buffer, "le", 8),
          endTimestampBN.toArrayLike(Buffer, "le", 8),
        ],
        PROGRAM_ID
      )

      const [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vault"),
          tokenMintPubkey.toBuffer(),
          targetMarketCapBN.toArrayLike(Buffer, "le", 8),
          endTimestampBN.toArrayLike(Buffer, "le", 8),
        ],
        PROGRAM_ID
      )
      
      console.log(`  Market PDA: ${marketPda.toString()} (bump: ${marketBump})`)
      console.log(`  Vault PDA: ${vaultPda.toString()} (bump: ${vaultBump})`)
      console.log(`  Token: ${tokenMintPubkey.toString()}`)
      console.log(`  Target: $${market.targetMarketCap.toLocaleString()}`)
      console.log(`  End: ${new Date(market.endTimestamp * 1000).toISOString()}`)

      // Add account sizes to IDL for program creation
      const idlWithSizes = {
        ...idl,
        metadata: {
          ...(idl.metadata || {}),
          address: PROGRAM_ID.toString(),
        },
        accounts: [
          {
            name: "Market",
            discriminator: [219, 190, 213, 55, 0, 227, 198, 154],
            size: 113,
          },
          {
            name: "Position",
            discriminator: [170, 188, 143, 228, 122, 64, 247, 208],
            size: 73,
          },
          {
            name: "Treasury",
            discriminator: [238, 239, 123, 238, 89, 1, 168, 253],
            size: 52,
          }
        ],
      }

      const program = new anchor.Program(idlWithSizes as any, provider) as any

      // Use program.methods with bumps
      const signature = await program.methods
        .createMarket(
          tokenMintPubkey,
          targetMarketCapBN,
          endTimestampBN,
          marketBump,
          vaultBump
        )
        .accounts({
          market: marketPda,
          marketVault: vaultPda,
          creator: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([])
        .rpc()

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

