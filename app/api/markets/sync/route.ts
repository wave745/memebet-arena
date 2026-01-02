import { NextResponse } from "next/server"

// Global in-memory storage for markets (temporary solution for Vercel)
let globalMarkets: any[] = []

export async function GET() {
    try {
        // In production (Vercel), return global markets
        // In development, try to read from database
        let markets = [...globalMarkets]

        if (process.env.NODE_ENV !== 'production') {
            try {
                const sqlite3 = require('sqlite3')
                const { open } = require('sqlite')

                const db = await open({
                    filename: './dev.db',
                    driver: sqlite3.Database
                })

                const dbMarkets = await db.all(`
                    SELECT pda, tokenMint, ticker, category, targetCap, endTimestamp, resolved, outcome, createdAt
                    FROM Market
                    ORDER BY createdAt DESC
                `)

                await db.close()

                // Merge database markets with global markets
                const existingPdas = new Set(globalMarkets.map(m => m.pda))
                for (const market of dbMarkets) {
                    if (!existingPdas.has(market.pda)) {
                        globalMarkets.push({
                            pda: market.pda,
                            tokenMint: market.tokenMint,
                            ticker: market.ticker,
                            category: market.category || 'new',
                            targetCap: market.targetCap,
                            endTimestamp: Number(market.endTimestamp),
                            resolved: !!market.resolved,
                            outcome: market.outcome !== null ? !!market.outcome : null,
                            createdAt: market.createdAt
                        })
                    }
                }

                markets = [...globalMarkets]
            } catch (dbError) {
                console.warn("Database not available, using global markets only:", dbError.message)
            }
        }

        console.log("API: Returning markets:", markets.length, markets.map(m => ({ pda: m.pda, ticker: m.ticker })))

        return NextResponse.json(markets)
    } catch (e) {
        console.error("Failed to fetch markets:", e)
        return NextResponse.json({ error: "Failed to fetch markets" }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { pda, tokenMint, ticker, category, targetCap, endTimestamp, resolved, outcome } = body

        const marketData = {
            pda,
            tokenMint,
            ticker,
            category: category || 'new',
            targetCap: targetCap?.toString() || '0',
            endTimestamp: Number(endTimestamp),
            resolved: !!resolved,
            outcome: outcome,
            createdAt: new Date().toISOString()
        }

        // Store in global array (works in serverless)
        const existingIndex = globalMarkets.findIndex(m => m.pda === pda)
        if (existingIndex >= 0) {
            globalMarkets[existingIndex] = marketData
        } else {
            globalMarkets.push(marketData)
        }

        // Try to sync to database if available (development only)
        if (process.env.NODE_ENV !== 'production') {
            try {
                const sqlite3 = require('sqlite3')
                const { open } = require('sqlite')

        const db = await open({
            filename: './dev.db',
            driver: sqlite3.Database
        })

        // Upsert market
        await db.run(`
            INSERT OR REPLACE INTO Market (pda, tokenMint, ticker, category, targetCap, endTimestamp, resolved, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            pda,
            tokenMint,
            ticker,
            category || 'new',
            targetCap?.toString() || '0',
            Number(endTimestamp),
                    !!resolved ? 1 : 0,
                    marketData.createdAt
                ])

                await db.close()
                console.log("Market synced to database:", pda)
            } catch (dbError) {
                console.warn("Database sync failed, using global storage only:", dbError.message)
            }
        }

        console.log("Market synced globally:", pda, "Total markets:", globalMarkets.length)
        return NextResponse.json(marketData)
    } catch (e) {
        console.error("Sync failed:", e)
        return NextResponse.json({ error: "Sync failed" }, { status: 500 })
    }
}
