import { NextResponse } from "next/server"
import { Pool } from '@neondatabase/serverless'

export async function GET(request: Request) {
    try {
        console.log("Leaderboard API called")
        const { searchParams } = new URL(request.url)
        const sortBy = (searchParams.get("sortBy") as 'volume' | 'pnl' | 'wins') || 'volume'
        const limit = Number(searchParams.get("limit")) || 50

        console.log("Leaderboard params:", { sortBy, limit })

        // Get leaderboard from Neon database inline
        console.log("Creating database pool...")
        const dbUrl = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_DFs85ANlpHJC@ep-royal-paper-ahfywd90-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
        console.log("Database URL available:", !!dbUrl)

        const pool = new Pool({
            connectionString: dbUrl,
        })

        console.log("Connecting to database...")
        const client = await pool.connect()
        console.log("Connected to database")

        let orderBy = '"totalVolume" DESC'
        if (sortBy === 'pnl') {
            orderBy = 'pnl DESC'
        } else if (sortBy === 'wins') {
            orderBy = 'wins DESC'
        }

        const query = `SELECT * FROM "UserStats" ORDER BY ${orderBy} LIMIT $1`
        console.log("Executing query:", query, "with limit:", limit)

        const result = await client.query(query, [limit])
        console.log("Query executed, found", result.rows.length, "rows")

        client.release()
        await pool.end()

        // Transform to expected format
        const formattedLeaderboard = result.rows.map(user => ({
            user: user.user,
            volume: parseFloat(user.totalVolume) / 1_000_000_000, // Convert lamports to SOL
            pnl: parseFloat(user.pnl) / 1_000_000_000, // Convert lamports to SOL
            totalBets: user.totalBets,
            wins: user.wins,
            losses: user.losses,
            lastActive: user.lastActive.getTime() / 1000 // Unix timestamp
        }))

        console.log("Returning leaderboard with", formattedLeaderboard.length, "users")
        return NextResponse.json(formattedLeaderboard)
    } catch (e) {
        console.error("Failed to fetch leaderboard:", e)
        console.error("Error stack:", e.stack)

        // Return empty array instead of 500 error to prevent frontend crashes
        console.log("Returning empty leaderboard due to error")
        return NextResponse.json([])
    }
}
