import { NextResponse } from "next/server"
import { Connection, clusterApiUrl } from "@solana/web3.js"
import { syncMarketsOnce } from "../../../../scripts/sync-markets-to-db"
import { DatabaseService } from "../../../../lib/database"

export async function POST(request: Request) {
    try {
        console.log("🔄 Starting market sync via API...")

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
        await syncMarketsOnce()

        // Get updated market count
        const dbMarkets = await DatabaseService.getAllMarkets()

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