'use server'

import { NextRequest, NextResponse } from "next/server"
import { Pool } from '@neondatabase/serverless'

// Server-only database operations for activities
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const marketPda = searchParams.get('marketPda')
    const limit = parseInt(searchParams.get('limit') || '50')

    const dbUrl = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_DFs85ANlpHJC@ep-royal-paper-ahfywd90-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    const pool = new Pool({ connectionString: dbUrl })

    const client = await pool.connect()
    try {
      let query = `
        SELECT
          id,
          "marketPda",
          "userAddress",
          type,
          content,
          amount,
          "createdAt"
        FROM "Activity"
      `
      let params: any[] = []

      if (marketPda) {
        query += ` WHERE "marketPda" = $1`
        params.push(marketPda)
      }

      query += ` ORDER BY "createdAt" DESC LIMIT $${params.length + 1}`
      params.push(Math.min(limit, 100)) // Cap at 100

      const result = await client.query(query, params)

      const activities = result.rows.map(row => ({
        id: row.id,
        marketPda: row.marketPda,
        userAddress: row.userAddress,
        type: row.type,
        content: row.content,
        amount: row.amount,
        createdAt: row.createdAt
      }))

      return NextResponse.json(activities)
    } finally {
      client.release()
      await pool.end()
    }
  } catch (error: any) {
    console.error("Failed to fetch activities:", error)
    return NextResponse.json({ error: "Failed to fetch activities" }, { status: 500 })
  }
}

// POST endpoint for creating activities
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { marketPda, userAddress, type, content, amount } = body

    if (!marketPda || !userAddress || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const dbUrl = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_DFs85ANlpHJC@ep-royal-paper-ahfywd90-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    const pool = new Pool({ connectionString: dbUrl })

    const client = await pool.connect()
    try {
      // Insert activity
      const insertQuery = `
        INSERT INTO "Activity" ("marketPda", "userAddress", type, content, amount)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `
      const insertResult = await client.query(insertQuery, [
        marketPda,
        userAddress,
        type,
        content || null,
        amount || null
      ])

      // Update user stats if this is a bet/trade
      if (type === 'bet' || type === 'trade') {
        const statsQuery = `
          INSERT INTO "UserStats" ("userAddress", "totalVolume", "totalPnl", "winRate", "totalBets")
          VALUES ($1, $2, 0, 0, 1)
          ON CONFLICT ("userAddress") DO UPDATE SET
            "totalVolume" = "UserStats"."totalVolume" + $2,
            "totalBets" = "UserStats"."totalBets" + 1,
            "updatedAt" = NOW()
        `
        await client.query(statsQuery, [userAddress, amount || 0])
      }

      return NextResponse.json({
        success: true,
        activity: insertResult.rows[0]
      })
    } finally {
      client.release()
      await pool.end()
    }
  } catch (error: any) {
    console.error("Failed to create activity:", error)
    return NextResponse.json({ error: "Failed to create activity" }, { status: 500 })
  }
}