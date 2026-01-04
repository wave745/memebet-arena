import { NextResponse } from "next/server"
import { Pool } from '@neondatabase/serverless'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const limit = Number(searchParams.get("limit")) || 50
        const marketPda = searchParams.get("marketPda")

        // Get activities from Neon database inline
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_DFs85ANlpHJC@ep-royal-paper-ahfywd90-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
        })

        const client = await pool.connect()

        let query = `
            SELECT a.*, m.* as market
            FROM "Activity" a
            LEFT JOIN "Market" m ON a."marketId" = m.id
            WHERE 1=1
        `
        const values: any[] = []
        let paramCount = 0

        if (marketPda) {
            // If marketId is a PDA, find the actual market ID
            const marketQuery = 'SELECT id FROM "Market" WHERE pda = $1'
            const marketResult = await client.query(marketQuery, [marketPda])
            if (marketResult.rows[0]) {
                query += ` AND a."marketId" = $${++paramCount}`
                values.push(marketResult.rows[0].id)
            } else {
                query += ` AND a."marketId" = $${++paramCount}`
                values.push(marketPda)
            }
        }

        // Filter for specific activity types
        query += ` AND a.type = ANY($${++paramCount})`
        values.push(['BET_YES', 'BET_NO', 'RESOLVE', 'SELL'])

        query += ` ORDER BY a.timestamp DESC LIMIT $${++paramCount}`
        values.push(limit)

        const result = await client.query(query, values)
        const activities = result.rows

        client.release()
        await pool.end()

        // Transform to expected format
        const formattedActivities = activities.map(activity => ({
            id: activity.id,
            txHash: activity.txHash,
            type: activity.type,
            user: activity.user,
            amount: activity.amount,
            timestamp: Number(activity.timestamp),
            market: {
                ticker: activity.market?.tokenSymbol,
                tokenMint: activity.market?.tokenMint,
                category: activity.market?.category || 'new'
            }
        }))

        console.log(`📊 Returning ${formattedActivities.length} activities ${marketPda ? `for market ${marketPda}` : 'globally'}`)

        return NextResponse.json(formattedActivities)
    } catch (e) {
        console.error("Failed to fetch activities:", e)
        return NextResponse.json({ error: "Failed to fetch activities" }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { txHash, type, marketPda, user, amount, outcome, timestamp, marketInfo } = body

        const activityTimestamp = BigInt(timestamp || Math.floor(Date.now() / 1000))

        // Skip CREATE_MARKET activities as requested
        if (type === 'CREATE_MARKET') {
            console.log(`⏭️ Skipping CREATE_MARKET activity for ${marketPda}`)
            return NextResponse.json({ message: "CREATE_MARKET activities are not logged" })
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_DFs85ANlpHJC@ep-royal-paper-ahfywd90-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
        })

        const client = await pool.connect()

        try {
            // Create or update market in database first
            if (marketInfo) {
                const query = `
                    INSERT INTO "Market" (
                      pda, "tokenMint", "tokenSymbol", "tokenName", "tokenImage",
                      "targetCap", "endTimestamp", resolved, outcome, "finalMarketCap"
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    ON CONFLICT (pda) DO UPDATE SET
                      "tokenSymbol" = EXCLUDED."tokenSymbol",
                      "tokenName" = EXCLUDED."tokenName",
                      "tokenImage" = EXCLUDED."tokenImage",
                      resolved = EXCLUDED.resolved,
                      outcome = EXCLUDED.outcome,
                      "finalMarketCap" = EXCLUDED."finalMarketCap"
                    RETURNING *
                `

                const values = [
                    marketPda,
                    marketInfo.tokenMint,
                    marketInfo.ticker,
                    marketInfo.tokenName,
                    marketInfo.tokenImage,
                    marketInfo.targetCap?.toString() || '0',
                    Math.floor(Number(marketInfo.endTimestamp)).toString(),
                    marketInfo.resolved || false,
                    marketInfo.outcome !== undefined ? marketInfo.outcome : null,
                    marketInfo.finalMarketCap
                ]

                await client.query(query, values)
            }

            // Create activity in database
            // First, get the market ID from PDA if needed
            let marketId = marketPda
            const marketQuery = 'SELECT id FROM "Market" WHERE pda = $1'
            const marketResult = await client.query(marketQuery, [marketPda])

            if (marketResult.rows[0]) {
                marketId = marketResult.rows[0].id
            }

            const activityQuery = `
                INSERT INTO "Activity" (
                  "txHash", type, "marketId", "user", amount, slot, timestamp
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `

            const activityValues = [
                txHash,
                type,
                marketId,
                user,
                amount.toString(),
                '0', // slot
                activityTimestamp.toString()
            ]

            const activityResult = await client.query(activityQuery, activityValues)
            const activity = activityResult.rows[0]

            // Update user stats
            try {
                let isWin: boolean | undefined
                if (type === 'RESOLVE' && outcome !== undefined) {
                    // For resolution, we don't know individual wins/losses here
                    // This would need more complex logic to track individual positions
                }

                const amountNum = parseFloat(amount.toString()) / 1_000_000_000 // Convert lamports to SOL

                // Check if user stats exist
                const checkQuery = 'SELECT * FROM "UserStats" WHERE "user" = $1'
                const checkResult = await client.query(checkQuery, [user])

                if (checkResult.rows.length === 0) {
                    // Create new user stats
                    const insertQuery = `
                      INSERT INTO "UserStats" (
                        "user", "totalVolume", "totalBets", wins, losses, pnl
                      ) VALUES ($1, $2, $3, $4, $5, $6)
                    `
                    await client.query(insertQuery, [
                        user,
                        amount.toString(),
                        1,
                        isWin ? 1 : 0,
                        isWin === false ? 1 : 0,
                        isWin ? amount.toString() : '0'
                    ])
                } else {
                    // Update existing stats
                    const currentStats = checkResult.rows[0]
                    const currentVolume = parseFloat(currentStats.totalVolume) / 1_000_000_000
                    const currentPnl = parseFloat(currentStats.pnl) / 1_000_000_000

                    let newPnl = currentPnl
                    if (type === 'BET_YES' || type === 'BET_NO') {
                        newPnl = currentPnl
                    } else if (type === 'SELL') {
                        newPnl = currentPnl + amountNum
                    }

                    const updateQuery = `
                      UPDATE "UserStats"
                      SET
                        "totalVolume" = $1,
                        "totalBets" = "totalBets" + 1,
                        wins = CASE WHEN $2 THEN wins + 1 ELSE wins END,
                        losses = CASE WHEN $3 THEN losses + 1 ELSE losses END,
                        pnl = $4,
                        "lastActive" = NOW()
                      WHERE "user" = $5
                    `

                    await client.query(updateQuery, [
                        (currentVolume + amountNum).toString(),
                        isWin ? true : false,
                        isWin === false ? true : false,
                        newPnl.toString(),
                        user
                    ])
                }
            } catch (statsError) {
                console.warn("Failed to update user stats:", statsError)
                // Don't fail the whole request for stats errors
            }

            console.log(`📊 Activity logged to DB: ${type} by ${user} for ${amount} on market ${marketPda}`)

            return NextResponse.json({
                id: activity.id,
                txHash: activity.txHash,
                type: activity.type,
                user: activity.user,
                amount: activity.amount,
                timestamp: Number(activity.timestamp)
            })
        } finally {
            client.release()
            await pool.end()
        }
    } catch (e) {
        console.error("Failed to create activity:", e)
        return NextResponse.json({ error: "Failed to create activity" }, { status: 500 })
    }
}
