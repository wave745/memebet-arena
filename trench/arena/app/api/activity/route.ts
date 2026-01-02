import { NextResponse } from "next/server"
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const limit = Number(searchParams.get("limit")) || 20
        const marketPda = searchParams.get("marketPda")

        // Open database connection
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

        const activities = await db.all(query, params)

        await db.close()

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

        // Open database connection
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
        const result = await db.run(`
            INSERT INTO Activity (txHash, slot, timestamp, type, marketPda, user, amount)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            txHash,
            0,
            timestamp || Math.floor(Date.now() / 1000),
            type,
            marketPda,
            user,
            amount.toString()
        ])

        await db.close()

        return NextResponse.json({
            id: result.lastID,
            txHash,
            type,
            marketPda,
            user,
            amount: amount.toString(),
            timestamp: timestamp || Math.floor(Date.now() / 1000)
        })
    } catch (e) {
        console.error("Failed to create activity:", e)
        return NextResponse.json({ error: "Failed to create activity" }, { status: 500 })
    }
}
