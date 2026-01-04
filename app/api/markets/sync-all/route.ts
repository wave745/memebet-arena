import { NextResponse } from "next/server"
import { Connection, clusterApiUrl } from "@solana/web3.js"

// Conditionally import database and sync modules (not available in Vercel build)
let runMarketSync: any = null
let basicDatabase: any = null

try {
    // Only import in Node.js environment with database access
    if (typeof window === 'undefined' && process.env.DATABASE_URL) {
        const syncModule = require("../../../../scripts/simple-sync")
        runMarketSync = syncModule.runMarketSync

        const dbModule = require("../../../lib/basic-database")
        basicDatabase = dbModule.basicDatabase
    }
} catch (error) {
    console.warn("Database modules not available:", error)
}

export async function POST(request: Request) {
    try {
        console.log("🔄 Starting market sync via API...")

        // Check if required modules are available
        if (!runMarketSync || !basicDatabase) {
            return NextResponse.json({
                success: false,
                error: "Market sync not available in this environment"
            }, { status: 503 })
        }

        // Check if database is configured
        if (!process.env.DATABASE_URL) {
            return NextResponse.json({
                success: false,
                error: "Database not configured"
            }, { status: 500 })
        }

        // Initialize connection
        const connection = new Connection(
            process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl("mainnet-beta"),
            "confirmed"
        )

        // This will trigger the full sync process
        await runMarketSync()

        // Get updated market count
        const dbMarkets = await basicDatabase.getAllMarkets()

        return NextResponse.json({
            success: true,
            message: "Market sync completed successfully",
            marketsCount: dbMarkets.length
        })

    } catch (error: any) {
        console.error("❌ Market sync API failed:", error)
        return NextResponse.json({
            success: false,
            error: error.message || "Market sync failed"
        }, { status: 500 })
    }
}

// Also support GET for manual triggering (useful for testing)
export async function GET(request: Request) {
    return POST(request)
}