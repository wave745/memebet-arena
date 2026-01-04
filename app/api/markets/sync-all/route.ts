import { NextResponse } from "next/server"

export async function POST(request: Request) {
    // Market sync is not available in Vercel/serverless environment
    // This functionality requires direct database and blockchain access
    return NextResponse.json({
        success: false,
        error: "Market sync is only available in development/local environment",
        message: "Use the local development server to sync markets from blockchain to database"
    }, { status: 503 })
}

// Also support GET for manual triggering (useful for testing)
export async function GET(request: Request) {
    return POST(request)
}