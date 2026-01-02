import { NextResponse } from "next/server"
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

// Global in-memory storage for activities (Vercel-compatible)
let globalActivities: any[] = []

export async function GET() {
    try {
        let activities = [...globalActivities]

        // In development, try to merge with database
        if (process.env.NODE_ENV !== 'production') {
            try {
                const db = await open({
                    filename: './dev.db',
                    driver: sqlite3.Database
                })

                const dbActivities = await db.all(`
                    SELECT user, amount, timestamp, type
                    FROM Activity
                    WHERE type IN ('BET_YES', 'BET_NO', 'SELL')
                `)

                // Merge with global activities, avoiding duplicates
                const existingTxHashes = new Set(globalActivities.map(a => a.txHash))
                for (const activity of dbActivities) {
                    if (!existingTxHashes.has(activity.txHash)) {
                        activities.push(activity)
                    }
                }

                await db.close()
            } catch (dbError: any) {
                console.warn("Leaderboard API: Database not available, using global activities only:", dbError.message)
            }
        }

        // Process activities to calculate volume and counts
        const userStats = new Map<string, { volume: number, txCount: number, lastActive: number }>()

        activities.forEach((activity: any) => {
            if (activity.type && ['BET_YES', 'BET_NO', 'SELL'].includes(activity.type)) {
                const amount = parseFloat(activity.amount) / 1_000_000_000 // Lamports to SOL
                const current = userStats.get(activity.user) || { volume: 0, txCount: 0, lastActive: 0 }

                userStats.set(activity.user, {
                    volume: current.volume + amount,
                    txCount: current.txCount + 1,
                    lastActive: Math.max(current.lastActive, activity.timestamp)
                })
            }
        })

        // Convert to array and sort by volume
        const leaderboard = Array.from(userStats.entries())
            .map(([user, stats]) => ({
                user,
                ...stats
            }))
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 50) // Top 50

        return NextResponse.json(leaderboard)
    } catch (e) {
        console.error("Failed to fetch leaderboard:", e)
        return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 })
    }
}
