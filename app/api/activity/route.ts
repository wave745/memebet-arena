import { NextResponse } from "next/server"

// Global in-memory storage for activities (Vercel-compatible)
let globalActivities: any[] = []

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const limit = Number(searchParams.get("limit")) || 50
        const marketPda = searchParams.get("marketPda")

        // In production (Vercel), use global activities
        // In development, try to merge with database
        let activities = [...globalActivities]

        if (process.env.NODE_ENV !== 'production') {
            try {
                const sqlite3 = require('sqlite3')
                const { open } = require('sqlite')

                const db = await open({
                    filename: './dev.db',
                    driver: sqlite3.Database
                })

                let query = `
                    SELECT
                        a.id,
                        a.txHash,
                        a.type,
                        a.user,
                        a.amount,
                        a.timestamp,
                        m.ticker,
                        m.tokenMint,
                        m.category
                    FROM Activity a
                    LEFT JOIN Market m ON a.marketPda = m.pda
                `

                const params: any[] = []

                if (marketPda) {
                    query += ` WHERE a.marketPda = ?`
                    params.push(marketPda)
                }

                query += ` ORDER BY a.timestamp DESC LIMIT ?`
                params.push(limit)

                const dbActivities = await db.all(query, params)
                await db.close()

                // Merge database activities with global activities
                const existingTxHashes = new Set(globalActivities.map(a => a.txHash))
                for (const activity of dbActivities) {
                    if (!existingTxHashes.has(activity.txHash)) {
                        globalActivities.push({
                            id: activity.id,
                            txHash: activity.txHash,
                            type: activity.type,
                            user: activity.user,
                            amount: activity.amount,
                            timestamp: activity.timestamp,
                            market: {
                                ticker: activity.ticker,
                                tokenMint: activity.tokenMint,
                                category: activity.category || 'new'
                            }
                        })
                    }
                }

                activities = [...globalActivities]
            } catch (dbError) {
                console.warn("Database not available, using global activities only:", dbError.message)
            }
        }

        // Filter by market if specified
        if (marketPda) {
            activities = activities.filter(a => a.marketPda === marketPda)
        }

        // Sort by timestamp descending and limit
        activities.sort((a, b) => b.timestamp - a.timestamp)
        activities = activities.slice(0, limit)

        console.log(`📊 Returning ${activities.length} activities ${marketPda ? `for market ${marketPda}` : 'globally'}`)

        return NextResponse.json(activities)
    } catch (e) {
        console.error("Failed to fetch activities:", e)
        return NextResponse.json({ error: "Failed to fetch activities" }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { txHash, type, marketPda, user, amount, outcome, timestamp, marketInfo } = body

        const activityTimestamp = timestamp || Math.floor(Date.now() / 1000)

        // Create activity object
        const newActivity = {
            id: Date.now().toString(), // Simple ID for global storage
            txHash,
            type,
            user,
            amount: amount.toString(),
            timestamp: activityTimestamp,
            marketPda,
            market: marketInfo ? {
                ticker: marketInfo.ticker,
                tokenMint: marketInfo.tokenMint,
                category: marketInfo.category || 'new'
            } : null
        }

        // Add to global activities (always available)
        globalActivities.unshift(newActivity) // Add to beginning for latest first

        // Keep only last 1000 activities to prevent memory bloat
        if (globalActivities.length > 1000) {
            globalActivities = globalActivities.slice(0, 1000)
        }

        // Also save to database in development
        if (process.env.NODE_ENV !== 'production') {
            try {
                const sqlite3 = require('sqlite3')
                const { open } = require('sqlite')

                const db = await open({
                    filename: './dev.db',
                    driver: sqlite3.Database
                })

                // Ensure market exists
                if (marketInfo) {
                    await db.run(`
                        INSERT OR REPLACE INTO Market (pda, tokenMint, ticker, category, targetCap, endTimestamp, resolved, createdAt)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        marketPda,
                        marketInfo.tokenMint,
                        marketInfo.ticker,
                        marketInfo.category || 'new',
                        marketInfo.targetCap?.toString() || '0',
                        Number(marketInfo.endTimestamp),
                        marketInfo.resolved || false,
                        new Date().toISOString()
                    ])
                }

                // Create activity
                await db.run(`
                    INSERT INTO Activity (txHash, slot, timestamp, type, marketPda, user, amount)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    txHash,
                    0,
                    activityTimestamp,
                    type,
                    marketPda,
                    user,
                    amount.toString()
                ])

                await db.close()
            } catch (dbError) {
                console.warn("Database save failed, using global storage only:", dbError.message)
            }
        }

        console.log(`📊 Activity logged: ${type} by ${user} for ${amount} lamports on market ${marketPda}`)

        return NextResponse.json(newActivity)
    } catch (e) {
        console.error("Failed to create activity:", e)
        return NextResponse.json({ error: "Failed to create activity" }, { status: 500 })
    }
}
