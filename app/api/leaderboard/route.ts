'use server'

import { NextResponse } from "next/server"
import { Pool } from '@neondatabase/serverless'

// Server-only database operations for leaderboard
export async function GET() {
  try {
    const dbUrl = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_DFs85ANlpHJC@ep-royal-paper-ahfywd90-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    const pool = new Pool({ connectionString: dbUrl })

    const client = await pool.connect()
    try {
      // Get user statistics for leaderboard
      const result = await client.query(`
        SELECT
          "userAddress",
          "totalVolume",
          "totalPnl",
          "winRate",
          "totalBets",
          "updatedAt"
        FROM "UserStats"
        ORDER BY "totalPnl" DESC
        LIMIT 100
      `)

      const leaderboard = result.rows.map(row => ({
        userAddress: row.userAddress,
        totalVolume: row.totalVolume,
        totalPnl: row.totalPnl,
        winRate: row.winRate,
        totalBets: row.totalBets,
        updatedAt: row.updatedAt
      }))

      return NextResponse.json(leaderboard)
    } finally {
      client.release()
      await pool.end()
    }
  } catch (error: any) {
    console.error("Failed to fetch leaderboard:", error)
    // Return empty array instead of error to prevent frontend crashes
    return NextResponse.json([])
  }
}