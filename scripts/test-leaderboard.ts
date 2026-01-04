#!/usr/bin/env ts-node

import 'dotenv/config'
import { Pool } from '@neondatabase/serverless'

async function testLeaderboard() {
  console.log("Testing leaderboard query...")

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  })

  try {
    const client = await pool.connect()
    console.log("Connected to database")

    const result = await client.query('SELECT * FROM "UserStats" ORDER BY "totalVolume" DESC LIMIT 10')
    console.log(`Found ${result.rows.length} user stats`)

    if (result.rows.length > 0) {
      console.log("Sample user:", result.rows[0])
    }

    client.release()
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await pool.end()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  testLeaderboard()
}