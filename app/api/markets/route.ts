'use server'

import { NextResponse } from "next/server"
import { Pool } from '@neondatabase/serverless'

// Server-only database operations
export async function GET() {
  try {
    const dbUrl = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_DFs85ANlpHJC@ep-royal-paper-ahfywd90-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    const pool = new Pool({ connectionString: dbUrl })

    const client = await pool.connect()
    try {
      // Get all markets with basic info
      const result = await client.query(`
        SELECT
          id,
          pda,
          "tokenMint",
          "tokenSymbol",
          "tokenName",
          "tokenImage",
          "targetCap",
          "endTimestamp",
          resolved,
          outcome,
          "finalMarketCap",
          "createdAt"
        FROM "Market"
        ORDER BY "createdAt" DESC
      `)

      const markets = result.rows.map(row => ({
        id: row.id,
        pda: row.pda,
        tokenMint: row.tokenMint,
        tokenSymbol: row.tokenSymbol,
        tokenName: row.tokenName,
        tokenImage: row.tokenImage,
        targetMarketCap: row.targetCap,
        endTimestamp: row.endTimestamp,
        resolved: row.resolved,
        outcome: row.outcome,
        finalMarketCap: row.finalMarketCap,
        createdAt: row.createdAt
      }))

      return NextResponse.json(markets)
    } finally {
      client.release()
      await pool.end()
    }
  } catch (error: any) {
    console.error("Failed to fetch markets:", error)
    return NextResponse.json({ error: "Failed to fetch markets" }, { status: 500 })
  }
}