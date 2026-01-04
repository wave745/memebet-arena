import { NextResponse } from "next/server"

export async function GET() {
    console.log("Debug: Checking environment...")

    const dbUrl = process.env.DATABASE_URL
    const hasDbUrl = !!dbUrl
    const dbUrlPreview = dbUrl ? dbUrl.substring(0, 20) + "..." : "NOT SET"

    console.log("Debug: DATABASE_URL available:", hasDbUrl)
    console.log("Debug: DATABASE_URL preview:", dbUrlPreview)

    // Test basic database import
    try {
        console.log("Debug: Testing database import...")
        // Only try to import in environments where pg is available
        if (typeof window === 'undefined') {
            const { simpleDB } = await import("../../../lib/simple-db")
            console.log("Debug: Database import successful")

            // Now try to actually connect and query
            console.log("Debug: Testing database connection...")
            const markets = await simpleDB.getAllMarkets(10)
            console.log("Debug: Database query successful, got", markets.length, "markets")
        } else {
            console.log("Debug: Skipping database test in browser environment")
        }

        return NextResponse.json({
            success: true,
            dbUrlAvailable: hasDbUrl,
            dbUrlPreview,
            importSuccessful: true,
            connectionSuccessful: true,
            marketCount: markets.length,
            message: "Full database test passed"
        })
    } catch (error: any) {
        console.error("Debug: Database operation failed:", error)
        return NextResponse.json({
            success: false,
            dbUrlAvailable: hasDbUrl,
            dbUrlPreview,
            importSuccessful: true,
            connectionSuccessful: false,
            error: error.message,
            stack: error.stack?.substring(0, 500)
        }, { status: 500 })
    }
}