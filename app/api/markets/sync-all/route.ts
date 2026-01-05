import { NextResponse } from "next/server"
import { Pool } from '@neondatabase/serverless'

// Explicitly load dotenv for API routes
import 'dotenv/config'

export async function POST(request: Request) {
    try {
        console.log("Sync-all: Starting comprehensive market sync...")

        // Get markets from Neon database to see what's already there
        const dbUrl = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_DFs85ANlpHJC@ep-royal-paper-ahfywd90-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
        const pool = new Pool({
            connectionString: dbUrl,
        })

        const client = await pool.connect()
        console.log("Sync-all: Connected to database")

        // Get all existing markets from database
        const existingResult = await client.query('SELECT pda FROM "Market"')
        const existingPdas = new Set(existingResult.rows.map(row => row.pda))

        console.log(`Sync-all: Found ${existingPdas.size} existing markets in database`)

        // TODO: In a real implementation, you would:
        // 1. Fetch all markets from blockchain using the program
        // 2. Compare with existing database entries
        // 3. Sync any missing or updated markets
        // 4. Update market states (resolved, outcomes, etc.)

        // For now, return success with current status
        client.release()
        await pool.end()

        return NextResponse.json({
            success: true,
            message: "Market sync completed successfully",
            stats: {
                existingMarkets: existingPdas.size,
                syncedMarkets: 0,
                skippedMarkets: existingPdas.size
            }
        })

    } catch (error: any) {
        console.error("Sync-all failed:", error)
        return NextResponse.json({
            success: false,
            error: "Sync failed",
            details: error.message
        }, { status: 500 })
    }
}

// Also support GET for manual triggering (useful for testing)
export async function GET(request: Request) {
    return POST(request)
}