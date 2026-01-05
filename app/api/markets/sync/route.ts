'use server'

import { NextResponse } from "next/server"
import { Pool } from '@neondatabase/serverless'

// Explicitly load dotenv for API routes
import 'dotenv/config'

export async function GET() {
    try {
        console.log("API: Starting market fetch...")
        console.log("API: DATABASE_URL available:", !!process.env.DATABASE_URL)
        console.log("API: DATABASE_URL value:", process.env.DATABASE_URL)
        console.log("API: All env vars with DATABASE:", Object.keys(process.env).filter(key => key.includes('DATABASE')))

        // Get markets from Neon database inline
        console.log("API: Creating database connection...")
        const dbUrl = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_DFs85ANlpHJC@ep-royal-paper-ahfywd90-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
        console.log("API: Using DB URL:", dbUrl.substring(0, 20) + "...")
        const pool = new Pool({
            connectionString: dbUrl,
        })

        const client = await pool.connect()
        console.log("API: Connected to database")

        const result = await client.query('SELECT * FROM "Market" ORDER BY "createdAt" DESC LIMIT 1000')
        console.log("API: Got markets from DB:", result.rows.length)

        client.release()
        await pool.end()

        // Transform to expected format
        const formattedMarkets = result.rows.map(market => ({
            id: market.id,
            pda: market.pda,
            tokenMint: market.tokenMint,
            tokenSymbol: market.tokenSymbol,
            tokenName: market.tokenName,
            tokenImage: market.tokenImage,
            ticker: market.tokenSymbol, // Use tokenSymbol as ticker
            category: market.category,
            targetCap: market.targetCap,
            endTimestamp: Number(market.endTimestamp),
            resolved: market.resolved,
            outcome: market.outcome,
            finalMarketCap: market.finalMarketCap,
            createdAt: market.createdAt.toISOString()
        }))

        console.log("API: Returning markets:", formattedMarkets.length, formattedMarkets.map(m => ({ pda: m.pda, ticker: m.tokenSymbol })))

        return NextResponse.json(formattedMarkets)
    } catch (e) {
        console.error("API: Failed to fetch markets:", e)
        console.error("API: Error details:", e)
        return NextResponse.json({ error: "Failed to fetch markets", details: e.message }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const {
            pda,
            tokenMint,
            tokenSymbol,
            tokenName,
            tokenImage,
            ticker,
            category,
            targetCap,
            endTimestamp,
            resolved,
            outcome,
            finalMarketCap
        } = body

        // Market sync available in all environments

        // Sync to Neon database using direct SQL
        console.log("API: Creating database connection for sync...")
        const dbUrl = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_DFs85ANlpHJC@ep-royal-paper-ahfywd90-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
        const pool = new Pool({
            connectionString: dbUrl,
        })

        const client = await pool.connect()
        console.log("API: Connected to database for sync")

        const upsertQuery = `
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

        const upsertValues = [
          pda,
          tokenMint,
          tokenSymbol || ticker,
          tokenName,
          tokenImage,
          targetCap?.toString() || '0',
          Math.floor(Number(endTimestamp)).toString(),
          !!resolved,
          outcome !== undefined ? outcome : null,
          finalMarketCap?.toString()
        ]

        const market = await client.query(upsertQuery, upsertValues)

        const marketRow = market.rows[0]
        console.log("Market synced to database:", pda, "ID:", marketRow.id)

        client.release()
        await pool.end()

        return NextResponse.json({
            id: marketRow.id,
            pda: marketRow.pda,
            tokenMint: marketRow.tokenMint,
            tokenSymbol: marketRow.tokenSymbol,
            tokenName: marketRow.tokenName,
            tokenImage: marketRow.tokenImage,
            ticker: marketRow.tokenSymbol,
            category: market.category,
            targetCap: market.targetCap,
            endTimestamp: Number(market.endTimestamp),
            resolved: market.resolved,
            outcome: market.outcome,
            finalMarketCap: market.finalMarketCap,
            createdAt: market.createdAt.toISOString()
        })
    } catch (e) {
        console.error("Sync failed:", e)
        return NextResponse.json({ error: "Sync failed: " + e.message }, { status: 500 })
    }
}
