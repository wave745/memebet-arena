import { NextResponse } from "next/server"
import { Pool } from '@neondatabase/serverless'

// Inline database query without external imports
export async function GET() {
    try {
        console.log("Inline markets API called")

        // Create pool inline
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
        })

        console.log("Pool created")

        // Connect and query inline
        const client = await pool.connect()
        console.log("Client connected")

        const result = await client.query('SELECT * FROM "Market" ORDER BY "createdAt" DESC LIMIT 10')
        console.log(`Found ${result.rows.length} markets`)

        client.release()
        await pool.end()

        // Return raw data
        return NextResponse.json({
            success: true,
            markets: result.rows
        })
    } catch (error: any) {
        console.error("Inline API error:", error)
        return NextResponse.json({
            success: false,
            error: error.message,
            stack: error.stack?.substring(0, 500)
        }, { status: 500 })
    }
}