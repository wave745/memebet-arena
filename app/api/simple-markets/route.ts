import { NextResponse } from "next/server"

// Self-contained API that doesn't import external modules
export async function GET() {
    try {
        console.log("Simple markets API called")

        // Hardcoded response for testing
        const mockMarkets = [
            {
                id: "1",
                pda: "test-pda-1",
                tokenSymbol: "TEST",
                tokenName: "Test Token",
                ticker: "TEST",
                targetCap: "1000000",
                endTimestamp: 1767654000,
                resolved: false,
                outcome: null
            }
        ]

        console.log("Returning mock markets")
        return NextResponse.json(mockMarkets)
    } catch (error: any) {
        console.error("Simple API error:", error)
        return NextResponse.json({ error: "Simple API failed" }, { status: 500 })
    }
}