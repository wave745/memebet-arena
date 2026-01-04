#!/usr/bin/env ts-node

/**
 * Minimal market syncing script using raw SQL
 */

import 'dotenv/config'
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js"
import { Pool } from '@neondatabase/serverless'
// Program ID for the deployed contract
const PROGRAM_ID = new PublicKey("ACBgFwUQrHYhfHRWFTowCLGg7FKMnth4Pi7JgHndYvWL")

// Market account discriminator (first 8 bytes of sha256("account:Market"))
const MARKET_DISCRIMINATOR = Buffer.from([219, 190, 213, 55, 0, 227, 198, 154])

// Simple token metadata fetching
async function getTokenMetadataSimple(mintAddress: string) {
  try {
    // Try DexScreener first
    const response = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mintAddress}`, {
      timeout: 3000
    })

    if (response.ok) {
      const data = await response.json()
      if (data && data.length > 0) {
        const pair = data[0]
        const baseToken = pair.baseToken
        return {
          symbol: baseToken.symbol || 'UNKNOWN',
          name: baseToken.name || 'Unknown Token',
          image: baseToken.logoURI || pair.info?.imageUrl
        }
      }
    }

    // Fallback: return basic info
    return {
      symbol: 'UNKNOWN',
      name: 'Unknown Token',
      image: null
    }
  } catch (error) {
    console.warn(`Failed to fetch token metadata for ${mintAddress}:`, error.message)
    return {
      symbol: 'UNKNOWN',
      name: 'Unknown Token',
      image: null
    }
  }
}

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
    const allAccounts = await connection.getProgramAccounts(PROGRAM_ID)

    // Filter for Market accounts by checking discriminator
    const accounts = allAccounts.filter(account => {
      if (account.account.data.length < 8) return false
      const discriminator = account.account.data.subarray(0, 8)
      return discriminator.equals(MARKET_DISCRIMINATOR)
    })

    console.log(`📊 Found ${allAccounts.length} total accounts, ${accounts.length} Market accounts`)

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
 * Sync discovered markets to database
 */
async function syncMarketsToDatabase(connection: Connection, discoveredMarkets: { pubkey: PublicKey; account: any }[]) {
  console.log(`🔄 Syncing ${discoveredMarkets.length} markets to database...`)

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })

  let synced = 0
  let failed = 0

  try {
    // Process in batches
    const batchSize = 5

    for (let i = 0; i < discoveredMarkets.length; i += batchSize) {
      const batch = discoveredMarkets.slice(i, i + batchSize)

      for (const { pubkey, account } of batch) {
        const client = await pool.connect()
        try {
          // Get token metadata
          const tokenMetadata = await getTokenMetadataSimple(account.tokenMint.toString())
          const tokenSymbol = tokenMetadata.symbol
          const tokenName = tokenMetadata.name
          const tokenImage = tokenMetadata.image

          const query = `
            INSERT INTO "Market" (
              pda, "tokenMint", "tokenSymbol", "tokenName", "tokenImage",
              "targetCap", "endTimestamp", resolved, outcome, "finalMarketCap"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (pda) DO UPDATE SET
              "tokenSymbol" = EXCLUDED."tokenSymbol",
              "tokenName" = EXCLUDED."tokenName",
              "tokenImage" = EXCLUDED."tokenImage",
              resolved = EXCLUDED.resolved,
              outcome = EXCLUDED.outcome,
              "finalMarketCap" = EXCLUDED."finalMarketCap"
            RETURNING *
          `

          const values = [
            pubkey.toString(),
            account.tokenMint.toString(),
            tokenSymbol,
            tokenName,
            tokenImage,
            account.targetMarketCap.toString(),
            account.endTimestamp.toString(),
            account.resolved,
            account.outcome,
            null // finalMarketCap
          ]

          await client.query(query, values)
          console.log(`✅ Synced market: ${tokenSymbol} (${pubkey.toString().slice(0, 8)}...)`)
          synced++
        } catch (error) {
          console.error(`❌ Failed to sync market ${pubkey.toString()}:`, error)
          failed++
        } finally {
          client.release()
        }
      }

      // Small delay between batches
      if (i + batchSize < discoveredMarkets.length) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    console.log(`📊 Sync complete: ${synced} successful, ${failed} failed`)
    return { synced, failed }
  } finally {
    await pool.end()
  }
}

/**
 * Main sync function
 */
async function runMarketSync() {
  console.log("🚀 Starting minimal market sync...")

  // Initialize connection using the same RPC logic as the frontend
  const getRpcUrl = () => {
    if (process.env.NEXT_PUBLIC_RPC_URL) {
      // If it's a Helius URL, ensure API key is included
      if (process.env.NEXT_PUBLIC_RPC_URL.includes('helius')) {
        // Check if API key is already in the URL
        if (process.env.NEXT_PUBLIC_RPC_URL.includes('api-key')) {
          return process.env.NEXT_PUBLIC_RPC_URL
        }
        // If not, add the API key
        if (process.env.NEXT_PUBLIC_HELIUS_API_KEY) {
          return `${process.env.NEXT_PUBLIC_RPC_URL}?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`
        }
      }
      return process.env.NEXT_PUBLIC_RPC_URL
    }
    return clusterApiUrl("mainnet-beta")
  }

  const rpcUrl = getRpcUrl()
  console.log("Using RPC URL:", rpcUrl)

  const connection = new Connection(rpcUrl, "confirmed")

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
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const client = await pool.connect()
    try {
      const result = await client.query('SELECT COUNT(*) as count FROM "Market"')
      console.log(`📈 Database now contains ${result.rows[0].count} markets`)
    } finally {
      client.release()
      await pool.end()
    }

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