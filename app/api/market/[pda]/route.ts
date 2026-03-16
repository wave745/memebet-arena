import { NextRequest, NextResponse } from "next/server"
import { Pool } from "@neondatabase/serverless"
import { PublicKey } from "@solana/web3.js"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function GET(
  request: NextRequest,
  { params }: { params: { pda: string } }
) {
  try {
    console.log("API called with PDA:", params.pda)
    console.log("DATABASE_URL available:", !!process.env.DATABASE_URL)

    const marketPda = params.pda

    // Validate PDA format
    try {
      new PublicKey(marketPda)
    } catch {
      return NextResponse.json({ error: "Invalid PDA format" }, { status: 400 })
    }

    const client = await pool.connect()
    console.log("Database client connected")

    try {
      // Get market from database
      const result = await client.query(
        `SELECT * FROM "Market" WHERE pda = $1`,
        [marketPda]
      )

      console.log("Query result:", result.rows.length, "rows")

      if (result.rows.length === 0) {
        return NextResponse.json({ error: "Market not found" }, { status: 404 })
      }

      const market = result.rows[0]
      console.log("Found market:", market.tokenSymbol, "resolved:", market.resolved)

      // Return market data in the format expected by frontend
      const marketData = {
        marketPda: market.pda,
        tokenMint: market.tokenMint,
        tokenSymbol: market.tokenSymbol || 'UNKNOWN',
        tokenName: market.tokenName || 'Unknown Token',
        tokenImage: market.tokenImage,
        targetMarketCap: market.targetCap.toString(), // Convert to string for JSON
        endTimestamp: market.endTimestamp.toString(), // Convert to string for JSON
        resolved: market.resolved,
        outcome: market.outcome,
        yesPool: "0", // We don't track pools in DB
        noPool: "0",  // We don't track pools in DB
        creator: "11111111111111111111111111111112", // Default admin key
      }

      console.log("Returning market data:", marketData.resolved)
      return NextResponse.json(marketData)
    } finally {
      client.release()
    }
  } catch (error) {
    console.error("Database error:", error)
    return NextResponse.json({ error: "Internal server error: " + error.message }, { status: 500 })
  }
}