#!/usr/bin/env ts-node

/**
 * Automated market syncing from blockchain to Neon database
 * Can run as a one-time script or continuously as a background process
 */

import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js"
import { fetchMarketByPda } from "../lib/anchor/markets"
import { DatabaseService } from "../lib/database"
import { getTokenMetadata } from "../lib/utils/token-metadata"
import * as anchor from "@coral-xyz/anchor"

// Program ID for the deployed contract
const PROGRAM_ID = new PublicKey("ACBgFwUQrHYhfHRWFTowCLGg7FKMnth4Pi7JgHndYvWL")

// Market account discriminator (first 8 bytes of sha256("account:Market"))
const MARKET_DISCRIMINATOR = Buffer.from([219, 190, 213, 55, 0, 227, 198, 154])

/**
 * Parse market account data from raw Solana account bytes
 */
function parseMarketAccount(accountData: Buffer): any | null {
  try {
    // Check discriminator
    const discriminator = accountData.subarray(0, 8)
    if (!discriminator.equals(MARKET_DISCRIMINATOR)) {
      return null // Not a market account
    }

    // Parse account data according to Market struct
    let offset = 8 // Skip discriminator

    // creator: Pubkey (32 bytes)
    const creator = new PublicKey(accountData.subarray(offset, offset + 32))
    offset += 32

    // token_mint: Pubkey (32 bytes)
    const tokenMint = new PublicKey(accountData.subarray(offset, offset + 32))
    offset += 32

    // target_market_cap: u64 (8 bytes, little-endian)
    const targetMarketCap = accountData.readBigUInt64LE(offset)
    offset += 8

    // end_timestamp: i64 (8 bytes, little-endian)
    const endTimestamp = accountData.readBigInt64LE(offset)
    offset += 8

    // yes_pool: u64 (8 bytes, little-endian)
    const yesPool = accountData.readBigUInt64LE(offset)
    offset += 8

    // no_pool: u64 (8 bytes, little-endian)
    const noPool = accountData.readBigUInt64LE(offset)
    offset += 8

    // resolved: bool (1 byte)
    const resolved = accountData[offset] !== 0
    offset += 1

    // outcome: Option<bool> (1 byte enum discriminator + optional bool)
    let outcome: boolean | null = null
    const outcomeEnum = accountData[offset]
    offset += 1
    if (outcomeEnum === 1) { // Some variant
      outcome = accountData[offset] !== 0
      offset += 1
    }

    return {
      creator,
      tokenMint,
      targetMarketCap,
      endTimestamp,
      yesPool,
      noPool,
      resolved,
      outcome
    }
  } catch (error) {
    console.warn("Failed to parse market account:", error)
    return null
  }
}

/**
 * Discover all market accounts owned by the program
 */
async function discoverMarkets(connection: Connection): Promise<{ pubkey: PublicKey; account: any }[]> {
  console.log("🔍 Discovering markets from blockchain...")

  try {
    // Get all program accounts owned by our program
    const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        {
          // Filter by account size (Market accounts should be exactly this size)
          dataSize: 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 2, // discriminator + Market struct
        }
      ]
    })

    console.log(`📊 Found ${accounts.length} program accounts`)

    const markets: { pubkey: PublicKey; account: any }[] = []

    // Process in batches to avoid overwhelming the RPC
    const batchSize = 10
    for (let i = 0; i < accounts.length; i += batchSize) {
      const batch = accounts.slice(i, i + batchSize)

      for (const { pubkey, account } of batch) {
        const marketData = parseMarketAccount(account.data)
        if (marketData) {
          markets.push({ pubkey, account: marketData })
        }
      }

      // Small delay between batches to be respectful to RPC
      if (i + batchSize < accounts.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    console.log(`✅ Discovered ${markets.length} valid market accounts`)
    return markets
  } catch (error) {
    console.error("❌ Failed to discover markets:", error)
    return []
  }
}

/**
 * Sync discovered markets to database with token metadata
 */
async function syncDiscoveredMarkets(connection: Connection, discoveredMarkets: { pubkey: PublicKey; account: any }[]) {
  console.log(`🔄 Syncing ${discoveredMarkets.length} markets to database...`)

  let synced = 0
  let failed = 0

  // Process in batches to avoid overwhelming external APIs
  const batchSize = 5

  for (let i = 0; i < discoveredMarkets.length; i += batchSize) {
    const batch = discoveredMarkets.slice(i, i + batchSize)

    const promises = batch.map(async ({ pubkey, account }) => {
      try {
        // Get token metadata with caching
        const tokenMetadata = await getTokenMetadata(account.tokenMint.toString())

        // Calculate final market cap if resolved
        let finalMarketCap: string | undefined
        if (account.resolved && account.outcome !== null) {
          // For resolved markets, we need to get the final market cap from the resolution
          // This would need to be stored in the market account or retrieved from transaction logs
          // For now, we'll leave it undefined and it can be updated later during resolution
        }

        await DatabaseService.upsertMarket({
          pda: pubkey.toString(),
          tokenMint: account.tokenMint.toString(),
          tokenSymbol: tokenMetadata.symbol,
          tokenName: tokenMetadata.name,
          tokenImage: tokenMetadata.image,
          targetCap: account.targetMarketCap.toString(),
          endTimestamp: account.endTimestamp,
          resolved: account.resolved,
          outcome: account.outcome,
          finalMarketCap
        })

        console.log(`✅ Synced market: ${tokenMetadata.symbol || 'UNKNOWN'} (${pubkey.toString().slice(0, 8)}...)`)
        return { success: true }
      } catch (error) {
        console.error(`❌ Failed to sync market ${pubkey.toString()}:`, error)
        return { success: false }
      }
    })

    const results = await Promise.all(promises)

    for (const result of results) {
      if (result.success) {
        synced++
      } else {
        failed++
      }
    }

    // Small delay between batches to be respectful to APIs
    if (i + batchSize < discoveredMarkets.length) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  console.log(`📊 Sync complete: ${synced} successful, ${failed} failed`)
  return { synced, failed }
}

/**
 * One-time market synchronization
 */
async function syncMarketsToDatabase() {
  console.log("🚀 Starting automated market sync...")

  // Initialize connection
  const connection = new Connection(
    process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl("mainnet-beta"),
    "confirmed"
  )

  try {
    // Discover markets from blockchain
    const discoveredMarkets = await discoverMarkets(connection)

    if (discoveredMarkets.length === 0) {
      console.log("ℹ️ No markets found on blockchain")
      return
    }

    // Sync to database
    const { synced, failed } = await syncDiscoveredMarkets(connection, discoveredMarkets)

    // Verify sync
    const dbMarkets = await DatabaseService.getAllMarkets()
    console.log(`📈 Database now contains ${dbMarkets.length} markets`)

    if (failed > 0) {
      console.warn(`⚠️ ${failed} markets failed to sync`)
      process.exit(1)
    }

    console.log("🎉 Market sync completed successfully!")

  } catch (error) {
    console.error("❌ Market sync failed:", error)
    process.exit(1)
  }
}

/**
 * Continuous market synchronization (for background processing)
 */
async function startContinuousSync(intervalMinutes: number = 5) {
  console.log(`🔄 Starting continuous market sync (every ${intervalMinutes} minutes)...`)

  const connection = new Connection(
    process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl("mainnet-beta"),
    "confirmed"
  )

  // Initial sync
  try {
    const discoveredMarkets = await discoverMarkets(connection)
    await syncDiscoveredMarkets(connection, discoveredMarkets)
  } catch (error) {
    console.error("❌ Initial sync failed:", error)
  }

  // Set up interval
  setInterval(async () => {
    try {
      console.log("🔄 Running scheduled market sync...")
      const discoveredMarkets = await discoverMarkets(connection)
      await syncDiscoveredMarkets(connection, discoveredMarkets)
      console.log("✅ Scheduled sync complete")
    } catch (error) {
      console.error("❌ Scheduled sync failed:", error)
    }
  }, intervalMinutes * 60 * 1000)
}

// Manual market sync function for use in API routes
export async function syncMarketFromBlockchain(marketPda: string) {
  const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed")

  const dummyWallet = {
    publicKey: new PublicKey("11111111111111111111111111111112"),
    payer: new PublicKey("11111111111111111111111111111112"),
    signTransaction: async () => { throw new Error("Read-only") },
    signAllTransactions: async () => { throw new Error("Read-only") },
  } as unknown as anchor.Wallet

  try {
    const marketData = await fetchMarketByPda(connection, dummyWallet, new PublicKey(marketPda))

    if (marketData) {
      await DatabaseService.upsertMarket({
        pda: marketData.marketPda.toString(),
        tokenMint: marketData.tokenMint.toString(),
        tokenSymbol: marketData.tokenSymbol,
        tokenName: marketData.tokenName,
        tokenImage: marketData.tokenImage,
        targetCap: marketData.targetMarketCap.toString(),
        endTimestamp: BigInt(marketData.endTimestamp.toString()),
        resolved: marketData.resolved,
        outcome: marketData.outcome,
        finalMarketCap: marketData.finalMarketCap?.toString()
      })

      console.log(`✅ Synced market to DB: ${marketData.tokenSymbol}`)
      return marketData
    }
  } catch (error) {
    console.error(`❌ Failed to sync market ${marketPda}:`, error)
  }

  return null
}

// Export functions for use in other modules
export { syncMarketsToDatabase as syncMarketsOnce, startContinuousSync, syncDiscoveredMarkets }

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2)
  const command = args[0]

  if (command === 'continuous' || command === '--continuous') {
    const intervalMinutes = parseInt(args[1]) || 5
    startContinuousSync(intervalMinutes)
    // Keep process running for continuous sync
  } else {
    // Default: one-time sync
    syncMarketsToDatabase()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error)
        process.exit(1)
      })
  }
}