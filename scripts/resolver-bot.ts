import { Connection, Keypair, PublicKey } from "@solana/web3.js"
import * as anchor from "@coral-xyz/anchor"

// ---- Configuration ----

const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com"
const INDEXER_URL = process.env.INDEXER_URL || "http://localhost:3001"
const DEXSCREENER_BASE = "https://api.dexscreener.com/latest/dex/tokens"
const PROGRAM_ID = process.env.PROGRAM_ID || "YourProgramIdHere"

// ---- Types ----

interface UnresolvedMarket {
  marketId: number
  marketPda: string
  tokenMint: string
  targetMarketCap: number
  endTimestamp: number
}

interface DexScreenerTrade {
  priceUsd: number
  volumeUsd: number
  timestamp: number
}

interface DexScreenerResponse {
  trades: DexScreenerTrade[]
  circulatingSupply: number
}

// ---- Connection Setup ----

const connection = new Connection(RPC_URL, "confirmed")

function loadResolverKeypair(): Keypair {
  const key = process.env.RESOLVER_KEY
  if (!key) {
    throw new Error("RESOLVER_KEY environment variable required")
  }
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(key)))
}

// ---- VWAP Computation ----

function computeVWAP(trades: DexScreenerTrade[], endTs: number): number {
  const windowStart = endTs - 600 // 10 minutes before end

  let volumeSum = 0
  let priceVolumeSum = 0

  for (const trade of trades) {
    if (trade.timestamp >= windowStart && trade.timestamp <= endTs) {
      priceVolumeSum += trade.priceUsd * trade.volumeUsd
      volumeSum += trade.volumeUsd
    }
  }

  if (volumeSum === 0) {
    throw new Error("VWAP_ZERO_VOLUME: No trades in 10-minute window")
  }

  return priceVolumeSum / volumeSum
}

// ---- DexScreener Fetch ----

async function fetchDexScreenerData(tokenMint: string): Promise<DexScreenerResponse> {
  const response = await fetch(`${DEXSCREENER_BASE}/${tokenMint}`)

  if (!response.ok) {
    throw new Error(`DexScreener fetch failed: ${response.status}`)
  }

  const data = await response.json()

  // DexScreener returns pairs, we need to extract trades and supply
  // This is simplified - actual DexScreener API structure may differ
  const pair = data.pairs?.[0]

  if (!pair) {
    throw new Error(`No pair found for token ${tokenMint}`)
  }

  return {
    trades: pair.trades || [],
    circulatingSupply: pair.fdv / pair.priceUsd || 0,
  }
}

// ---- Indexer Fetch ----

async function fetchUnresolvedMarkets(): Promise<UnresolvedMarket[]> {
  const response = await fetch(`${INDEXER_URL}/markets/unresolved`)

  if (!response.ok) {
    throw new Error(`Indexer fetch failed: ${response.status}`)
  }

  return response.json()
}

// ---- Resolution Logic ----

function determineOutcome(marketCap: number, targetMarketCap: number): boolean {
  // Hard rule: >= target means YES wins, else NO wins
  // No rounding games. No grace margins. No retries.
  return marketCap >= targetMarketCap
}

// ---- Main Execution ----

async function resolveMarket(
  program: anchor.Program<any>,
  market: UnresolvedMarket,
  resolver: Keypair,
): Promise<void> {
  console.log(`\n--- Resolving Market ${market.marketId} ---`)
  console.log(`Token: ${market.tokenMint}`)
  console.log(`Target Market Cap: $${market.targetMarketCap.toLocaleString()}`)
  console.log(`End Timestamp: ${new Date(market.endTimestamp * 1000).toISOString()}`)

  // Fetch DexScreener data
  const dexData = await fetchDexScreenerData(market.tokenMint)

  // Compute VWAP over last 10 minutes before end_timestamp
  const vwap = computeVWAP(dexData.trades, market.endTimestamp)
  console.log(`VWAP (10min): $${vwap.toFixed(8)}`)

  // Compute market cap
  const marketCap = vwap * dexData.circulatingSupply
  console.log(`Computed Market Cap: $${marketCap.toLocaleString()}`)

  // Determine outcome
  const outcome = determineOutcome(marketCap, market.targetMarketCap)
  console.log(`Outcome: ${outcome ? "YES" : "NO"}`)

  // Submit resolution transaction
  const marketPda = new PublicKey(market.marketPda)

  // resolve_market takes final_market_cap (u64), not outcome (bool)
  // The program computes the outcome internally: final_market_cap >= target_market_cap
  const tx = await program.methods
    .resolveMarket(new anchor.BN(Math.floor(marketCap)))
    .accounts({
      market: marketPda,
      resolver: resolver.publicKey,
    })
    .signers([resolver])
    .rpc()

  console.log(`Resolution TX: ${tx}`)
  console.log(`Market ${market.marketId} resolved: ${outcome ? "YES" : "NO"}`)
  console.log(`Final Market Cap: $${marketCap.toLocaleString()}`)
}

async function run(): Promise<void> {
  console.log("=== MEMEBET ARENA RESOLVER BOT ===")
  console.log(`RPC: ${RPC_URL}`)
  console.log(`Indexer: ${INDEXER_URL}`)
  console.log(`Time: ${new Date().toISOString()}`)

  // Load resolver keypair
  const resolver = loadResolverKeypair()
  console.log(`Resolver: ${resolver.publicKey.toBase58()}`)

  // Setup Anchor provider and program
  const wallet = new anchor.Wallet(resolver)
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  })

  // Load program IDL
  const programId = new PublicKey(PROGRAM_ID)

  // In production, import the IDL from target/types/memebet_arena.ts
  // For now, we'll use anchor.workspace if available, otherwise load from file
  let program: anchor.Program<any>
  
  try {
    // Try to use workspace (works when running from project root)
    program = anchor.workspace.MemebetArena as anchor.Program<any>
    console.log(`Program loaded from workspace`)
  } catch {
    // Fallback: load IDL from file (would need to import IDL JSON)
    throw new Error("Program IDL not found. Build the program first with 'anchor build'")
  }
  
  console.log(`Program ID: ${programId.toBase58()}`)

  // Fetch unresolved markets
  const markets = await fetchUnresolvedMarkets()
  console.log(`\nFound ${markets.length} unresolved market(s)`)

  if (markets.length === 0) {
    console.log("No markets to resolve. Exiting.")
    return
  }

  // Resolve each market
  let resolved = 0
  let failed = 0

  for (const market of markets) {
    try {
      await resolveMarket(program, market, resolver)
      resolved++
    } catch (err) {
      console.error(`Failed to resolve market ${market.marketId}:`, err)
      failed++
    }
  }

  console.log(`\n=== RESOLUTION COMPLETE ===`)
  console.log(`Resolved: ${resolved}`)
  console.log(`Failed: ${failed}`)
}

// Execute
run()
  .then(() => {
    console.log("\nResolver bot finished.")
    process.exit(0)
  })
  .catch((err) => {
    console.error("Resolver bot crashed:", err)
    process.exit(1)
  })
