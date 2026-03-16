#!/usr/bin/env ts-node

/**
 * Simple market syncing script that doesn't depend on complex Anchor types
 */

import 'dotenv/config'
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js"

// Program ID for the deployed contract
const PROGRAM_ID = new PublicKey("G3ctDAx46fPX4cTZgzcgzW1rDCe7e8qCqhCUTSf3a7LP")

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
          dataSize: 106, // discriminator + Market struct
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
async function syncMarketsToDatabase(connection: Connection, discoveredMarkets: { pubkey: PublicKey; account: any }[]) {
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

        await basicDatabase.upsertMarket({
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
async function runMarketSync() {
  console.log("🚀 Starting automated market sync...")

  // Load modules dynamically
  const { basicDatabase } = await import("../lib/basic-database")
  const { getTokenMetadata } = await import("../lib/utils/token-metadata")

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
    const { synced, failed } = await syncMarketsToDatabase(connection, discoveredMarkets)

    // Verify sync
    const dbMarkets = await basicDatabase.getAllMarkets()
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

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMarketSync()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}