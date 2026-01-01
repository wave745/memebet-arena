import { NextResponse } from "next/server"
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

export async function GET() {
    try {
        // Open database connection
        const db = await open({
            filename: './dev.db',
            driver: sqlite3.Database
        })

        // Get all betting activities
        const bets = await db.all(`
            SELECT user, amount, timestamp
            FROM Activity
            WHERE type IN ('BET_YES', 'BET_NO', 'SELL')
        `)

        // Process bets to calculate volume and counts
        const userStats = new Map<string, { volume: number, txCount: number, lastActive: number }>()

        bets.forEach((bet: any) => {
            const amount = parseFloat(bet.amount) / 1_000_000_000 // Lamports to SOL
            const current = userStats.get(bet.user) || { volume: 0, txCount: 0, lastActive: 0 }

            userStats.set(bet.user, {
                volume: current.volume + amount,
                txCount: current.txCount + 1,
                lastActive: Math.max(current.lastActive, bet.timestamp)
            })
        })

        // Convert to array and sort by volume
        const leaderboard = Array.from(userStats.entries())
            .map(([user, stats]) => ({
                user,
                ...stats
            }))
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 50) // Top 50

        await db.close()

        return NextResponse.json(leaderboard)
    } catch (e) {
        console.error("Failed to fetch leaderboard:", e)
        return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 })
    }
}
