#!/usr/bin/env ts-node

/**
 * Sync markets from blockchain to Neon database
 * Run this script to populate the database with existing markets
 */

import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js"
import { fetchMarketByPda } from "../lib/anchor/markets"
import { DatabaseService } from "../lib/database"
import * as anchor from "@coral-xyz/anchor"

async function syncMarketsToDatabase() {
  console.log("🔄 Starting market sync to database...")

  // Initialize connection
  const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed")

  // Initialize wallet (dummy wallet for read-only operations)
  const dummyWallet = {
    publicKey: new PublicKey("11111111111111111111111111111112"),
    signTransaction: async () => { throw new Error("Read-only") },
    signAllTransactions: async () => { throw new Error("Read-only") },
  } as anchor.Wallet

  try {
    // For now, we'll need to know the market PDAs to sync
    // In a production setup, you'd scan all program accounts or have an indexer
    // For this demo, let's assume we have some known markets or scan recent ones

    // Example: If you have known market PDAs, add them here
    const knownMarketPdas = [
      // Add your market PDAs here, e.g.:
      // "YourMarketPDA1",
      // "YourMarketPDA2",
    ]

    console.log(`📊 Found ${knownMarketPdas.length} markets to sync`)

    for (const pdaStr of knownMarketPdas) {
      try {
        console.log(`🔍 Fetching market: ${pdaStr}`)
        const marketPda = new PublicKey(pdaStr)
        const marketData = await fetchMarketByPda(connection, dummyWallet, marketPda)

        if (marketData) {
          console.log(`💾 Syncing market: ${marketData.tokenSymbol} (${marketData.tokenMint.slice(0, 8)}...)`)

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

          console.log(`✅ Synced market: ${marketData.tokenSymbol}`)
        } else {
          console.warn(`⚠️ Market not found: ${pdaStr}`)
        }
      } catch (error) {
        console.error(`❌ Failed to sync market ${pdaStr}:`, error)
      }
    }

    console.log("🎉 Market sync completed!")

    // Verify sync by fetching from database
    const dbMarkets = await DatabaseService.getAllMarkets()
    console.log(`📈 Database now contains ${dbMarkets.length} markets`)

  } catch (error) {
    console.error("❌ Market sync failed:", error)
    process.exit(1)
  }
}

// Manual market sync function for use in API routes
export async function syncMarketFromBlockchain(marketPda: string) {
  const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed")

  const dummyWallet = {
    publicKey: new PublicKey("11111111111111111111111111111112"),
    signTransaction: async () => { throw new Error("Read-only") },
    signAllTransactions: async () => { throw new Error("Read-only") },
  } as anchor.Wallet

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

// Run if called directly
if (require.main === module) {
  syncMarketsToDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}