import { NextResponse } from "next/server"
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { pda, tokenMint, ticker, category, targetCap, endTimestamp, resolved, outcome } = body

        // Open database connection
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
            !!resolved ? 1 : 0, // SQLite uses 1/0 for boolean
            new Date().toISOString()
        ])

        // Update outcome if provided
        if (outcome !== undefined && outcome !== null) {
            await db.run(`
                UPDATE Market SET outcome = ? WHERE pda = ?
            `, [outcome ? 1 : 0, pda])
        }

        await db.close()

        return NextResponse.json({
            pda,
            tokenMint,
            ticker,
            category: category || 'new',
            targetCap: targetCap?.toString() || '0',
            endTimestamp: Number(endTimestamp),
            resolved: !!resolved,
            outcome: outcome
        })
    } catch (e) {
        console.error("Sync failed:", e)
        return NextResponse.json({ error: "Sync failed" }, { status: 500 })
    }
}