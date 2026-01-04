#!/usr/bin/env ts-node

/**
 * Check markets in database
 */

import 'dotenv/config'
import { Pool } from '@neondatabase/serverless'

async function checkMarkets() {
  console.log("📊 Checking markets in database...")

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })

  try {
    const client = await pool.connect()

    const result = await client.query(`
      SELECT pda, "tokenSymbol", "tokenName", "tokenImage", "targetCap", resolved
      FROM "Market"
      ORDER BY "createdAt" DESC
    `)

    console.log(`Found ${result.rows.length} markets:`)
    console.log("─".repeat(80))

    result.rows.forEach((market, i) => {
      console.log(`${i + 1}. ${market.tokenSymbol} (${market.tokenName})`)
      console.log(`   PDA: ${market.pda.slice(0, 12)}...`)
      console.log(`   Target Cap: $${parseFloat(market.targetCap).toLocaleString()}`)
      console.log(`   Resolved: ${market.resolved}`)
      console.log(`   Image: ${market.tokenImage || 'None'}`)
      console.log()
    })

    client.release()
  } catch (error) {
    console.error("❌ Error checking markets:", error)
  } finally {
    await pool.end()
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkMarkets()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}