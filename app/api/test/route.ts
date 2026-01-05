import { NextResponse } from "next/server"
import { Pool } from '@neondatabase/serverless'

export async function GET() {
    console.log("Test API called")

    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_DFs85ANlpHJC@ep-royal-paper-ahfywd90-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
        })

        const client = await pool.connect()

        // Check activity count
        const activityQuery = 'SELECT COUNT(*) as count FROM "Activity"'
        const activityResult = await client.query(activityQuery)

        // Check market count
        const marketQuery = 'SELECT COUNT(*) as count FROM "Market"'
        const marketResult = await client.query(marketQuery)

        // Get recent activities
        const recentQuery = 'SELECT type, "user", amount, timestamp FROM "Activity" ORDER BY timestamp DESC LIMIT 5'
        const recentResult = await client.query(recentQuery)

        client.release()
        await pool.end()

        return NextResponse.json({
            message: "Database connected successfully",
            timestamp: new Date().toISOString(),
            database: {
                activities: parseInt(activityResult.rows[0].count),
                markets: parseInt(marketResult.rows[0].count),
                recentActivities: recentResult.rows
            }
        })
    } catch (error) {
        console.error("Database test failed:", error)
        return NextResponse.json({
            error: "Database connection failed",
            message: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 })
    }
}