#!/usr/bin/env ts-node

/**
 * Test database connection
 */

import 'dotenv/config'
import { Pool } from '@neondatabase/serverless'

async function testDatabase() {
  console.log("🧪 Testing database connection...")

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })

  try {
    const client = await pool.connect()
    console.log("✅ Connected to database")

    // Test a simple query
    const result = await client.query('SELECT COUNT(*) as count FROM "Market"')
    console.log(`📊 Found ${result.rows[0].count} markets in database`)

    client.release()
    console.log("✅ Database test successful!")

  } catch (error) {
    console.error("❌ Database test failed:", error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}