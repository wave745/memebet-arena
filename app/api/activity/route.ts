'use server'

import { NextResponse } from "next/server"
import { Pool } from '@neondatabase/serverless'
import { Connection, PublicKey, Keypair, Transaction } from "@solana/web3.js"
import { buildResolveMarketInstruction } from "@/lib/solana/instructions"

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
        console.log('📨 POST request received at /api/activity')
        const rawBody = await request.text()
        console.log('📄 Raw request body:', rawBody)

        let body
        try {
            body = JSON.parse(rawBody)
            console.log('📦 Parsed body:', body)
        } catch (parseError) {
            console.error('❌ Failed to parse JSON:', parseError)
            return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
        }

        // Handle bulk resolution requests first
        if (body.action === 'bulk_resolve_all') {
            console.log('🎯 Routing to bulk resolution handler')
            return handleBulkResolveAll(body)
        }

        // Handle market resolution requests
        if (body.action === 'resolve_market') {
            console.log('🎯 Routing to single resolution handler')
            return handleResolveMarket(body)
        }

        // Handle regular activity creation
        console.log('📝 Processing as regular activity creation')
        const { txHash, type, marketPda, user, amount, outcome, timestamp, marketInfo } = body

        if (!txHash || !type) {
            console.error('❌ Missing required fields for activity creation')
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        console.log('📥 Activity POST received:', { txHash, type, marketPda, user, amount })

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

            const response = {
                id: activity.id,
                txHash: activity.txHash,
                type: activity.type,
                user: activity.user,
                amount: activity.amount,
                timestamp: Number(activity.timestamp)
            }
            console.log('📤 Activity API response:', response)

            return NextResponse.json(response)
        } finally {
            client.release()
            await pool.end()
        }
    } catch (e) {
        console.error("Failed to create activity:", e)
        return NextResponse.json({ error: "Failed to create activity" }, { status: 500 })
    }
}

async function handleResolveMarket(body: any) {
    try {
        const { marketPda, finalMarketCap } = body

        console.log('🎯 Backend market resolution requested:', { marketPda, finalMarketCap })

        // Validate inputs
        if (!marketPda || !finalMarketCap) {
            return NextResponse.json({ error: "Missing marketPda or finalMarketCap" }, { status: 400 })
        }

        // Check for admin private key in environment
        const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY
        if (!adminPrivateKey) {
            console.error('❌ ADMIN_PRIVATE_KEY not configured')
            return NextResponse.json({ error: "Admin wallet not configured" }, { status: 500 })
        }

        // Setup connection
        const connection = new Connection(
            process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com",
            "confirmed"
        )

        // Load admin keypair
        let adminKeypair: Keypair
        try {
            const secretKey = Uint8Array.from(JSON.parse(adminPrivateKey))
            adminKeypair = Keypair.fromSecretKey(secretKey)
            console.log('✅ Admin wallet loaded:', adminKeypair.publicKey.toString())
        } catch (error) {
            console.error('❌ Failed to load admin keypair:', error)
            return NextResponse.json({ error: "Invalid admin wallet configuration" }, { status: 500 })
        }

        // Check if market exists and is valid for resolution
        const marketPubkey = new PublicKey(marketPda)
        const marketAccount = await connection.getAccountInfo(marketPubkey)

        if (!marketAccount) {
            return NextResponse.json({ error: "Market not found" }, { status: 404 })
        }

        console.log('📊 Market account found, size:', marketAccount.data.length)

        // Create resolve instruction
        const finalMarketCapBigInt = BigInt(Math.floor(parseFloat(finalMarketCap)))
        const instruction = buildResolveMarketInstruction(
            marketPubkey,
            adminKeypair.publicKey,
            finalMarketCapBigInt
        )

        // Create and sign transaction
        const transaction = new Transaction().add(instruction)
        transaction.feePayer = adminKeypair.publicKey

        const { blockhash } = await connection.getLatestBlockhash("confirmed")
        transaction.recentBlockhash = blockhash

        transaction.sign(adminKeypair)

        // Send transaction
        console.log('📤 Sending resolve transaction...')
        const signature = await connection.sendRawTransaction(
            transaction.serialize(),
            { skipPreflight: false, maxRetries: 3 }
        )

        console.log('⏳ Waiting for confirmation...')
        await connection.confirmTransaction(signature, "confirmed")

        console.log('✅ Market resolved successfully:', signature)

        // Log the resolution activity
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_DFs85ANlpHJC@ep-royal-paper-ahfywd90-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
        })

        const client = await pool.connect()

        try {
            // Update market in database
            const marketQuery = `
                UPDATE "Market"
                SET resolved = true, "finalMarketCap" = $1
                WHERE pda = $2
            `
            await client.query(marketQuery, [finalMarketCap.toString(), marketPda])

            // Create resolution activity
            const activityQuery = `
                INSERT INTO "Activity" (
                  "txHash", type, "marketId", "user", amount, slot, timestamp
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            `

            const marketIdQuery = 'SELECT id FROM "Market" WHERE pda = $1'
            const marketResult = await client.query(marketIdQuery, [marketPda])
            const marketId = marketResult.rows[0]?.id || marketPda

            await client.query(activityQuery, [
                signature,
                'RESOLVE',
                marketId,
                adminKeypair.publicKey.toString(),
                '0',
                '0',
                BigInt(Math.floor(Date.now() / 1000)).toString()
            ])

            console.log('📊 Resolution activity logged')
        } finally {
            client.release()
            await pool.end()
        }

        return NextResponse.json({
            success: true,
            signature,
            message: "Market resolved successfully"
        })

    } catch (error: any) {
        console.error('❌ Market resolution failed:', error)
        return NextResponse.json({
            error: "Market resolution failed",
            details: error.message
        }, { status: 500 })
    }
}

async function handleBulkResolveAll(body: any) {
    try {
        console.log('🚀 Starting bulk market resolution...')

        // Check for admin private key in environment
        const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY
        console.log('🔑 ADMIN_PRIVATE_KEY present:', !!adminPrivateKey)
        if (!adminPrivateKey) {
            console.error('❌ ADMIN_PRIVATE_KEY not configured')
            return NextResponse.json({ error: "Admin wallet not configured" }, { status: 500 })
        }

        // Setup connection
        const connection = new Connection(
            process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com",
            "confirmed"
        )

        // Load admin keypair
        let adminKeypair: Keypair
        try {
            const secretKey = Uint8Array.from(JSON.parse(adminPrivateKey))
            adminKeypair = Keypair.fromSecretKey(secretKey)
            console.log('✅ Admin wallet loaded:', adminKeypair.publicKey.toString())
        } catch (error) {
            console.error('❌ Failed to load admin keypair:', error)
            return NextResponse.json({ error: "Invalid admin wallet configuration" }, { status: 500 })
        }

        // Query database for expired but unresolved markets
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_DFs85ANlpHJC@ep-royal-paper-ahfywd90-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
        })

        const client = await pool.connect()

        try {
            const expiredMarketsQuery = `
                SELECT * FROM "Market"
                WHERE resolved = false
                AND "endTimestamp" < $1
                ORDER BY "endTimestamp" ASC
            `
            const now = Math.floor(Date.now() / 1000)
            console.log('🔍 Querying for expired markets before:', new Date(now * 1000).toISOString())

            const expiredMarketsResult = await client.query(expiredMarketsQuery, [now.toString()])

            const expiredMarkets = expiredMarketsResult.rows
            console.log(`📊 Found ${expiredMarkets.length} expired markets to resolve`)

            if (expiredMarkets.length > 0) {
                console.log('📋 Markets to resolve:', expiredMarkets.map(m => ({
                    pda: m.pda,
                    token: m.tokenSymbol,
                    endTime: new Date(Number(m.endTimestamp) * 1000).toISOString(),
                    targetCap: m.targetCap
                })))
            }

            if (expiredMarkets.length === 0) {
                return NextResponse.json({
                    success: true,
                    message: "No expired markets to resolve",
                    resolvedCount: 0
                })
            }

            let resolvedCount = 0
            let failedCount = 0
            const results = []

            // Process each market
            for (const market of expiredMarkets) {
                try {
                    console.log(`🎯 Resolving market: ${market.pda} (${market.tokenSymbol})`)

                    // Get current market cap from DexScreener API
                    let currentMarketCap = 0
                    try {
                        const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${market.tokenMint}`)
                        const dexData = await dexResponse.json()

                        if (dexData.pairs && dexData.pairs.length > 0) {
                            // Find the pair with highest liquidity
                            const bestPair = dexData.pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0]
                            currentMarketCap = bestPair.marketCap || bestPair.fdv || 0
                            console.log(`📈 Current market cap for ${market.tokenSymbol}: $${currentMarketCap.toLocaleString()}`)
                        }
                    } catch (dexError) {
                        console.warn(`⚠️ Could not fetch market cap for ${market.tokenSymbol}, using target: $${market.targetCap}`)
                        currentMarketCap = Number(market.targetCap)
                    }

                    // Resolve the market
                    const marketPubkey = new PublicKey(market.pda)
                    const finalMarketCapBigInt = BigInt(Math.floor(currentMarketCap))

                    const instruction = buildResolveMarketInstruction(
                        marketPubkey,
                        adminKeypair.publicKey,
                        finalMarketCapBigInt
                    )

                    const transaction = new Transaction().add(instruction)
                    transaction.feePayer = adminKeypair.publicKey

                    const { blockhash } = await connection.getLatestBlockhash("confirmed")
                    transaction.recentBlockhash = blockhash

                    transaction.sign(adminKeypair)

                    console.log('📤 Sending resolve transaction...')
                    const signature = await connection.sendRawTransaction(
                        transaction.serialize(),
                        { skipPreflight: false, maxRetries: 3 }
                    )

                    console.log('⏳ Waiting for confirmation...')
                    await connection.confirmTransaction(signature, "confirmed")

                    // Update market in database
                    const updateQuery = `
                        UPDATE "Market"
                        SET resolved = true, "finalMarketCap" = $1
                        WHERE pda = $2
                    `
                    await client.query(updateQuery, [currentMarketCap.toString(), market.pda])

                    // Log resolution activity
                    const activityQuery = `
                        INSERT INTO "Activity" (
                          "txHash", type, "marketId", "user", amount, slot, timestamp
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `

                    await client.query(activityQuery, [
                        signature,
                        'RESOLVE',
                        market.id,
                        adminKeypair.publicKey.toString(),
                        '0',
                        '0',
                        BigInt(Math.floor(Date.now() / 1000)).toString()
                    ])

                    resolvedCount++
                    results.push({
                        market: market.pda,
                        token: market.tokenSymbol,
                        signature,
                        marketCap: currentMarketCap,
                        status: 'resolved'
                    })

                    console.log(`✅ Resolved ${market.tokenSymbol} for $${currentMarketCap.toLocaleString()}`)

                    // Small delay between transactions to avoid rate limits
                    await new Promise(resolve => setTimeout(resolve, 1000))

                } catch (marketError: any) {
                    console.error(`❌ Failed to resolve market ${market.pda}:`, marketError.message)
                    failedCount++
                    results.push({
                        market: market.pda,
                        token: market.tokenSymbol,
                        error: marketError.message,
                        status: 'failed'
                    })
                }
            }

            console.log(`🎉 Bulk resolution complete: ${resolvedCount} resolved, ${failedCount} failed`)

            return NextResponse.json({
                success: true,
                message: `Bulk resolution complete`,
                stats: {
                    total: expiredMarkets.length,
                    resolved: resolvedCount,
                    failed: failedCount
                },
                results
            })

        } finally {
            client.release()
            await pool.end()
        }

    } catch (error: any) {
        console.error('❌ Bulk resolution failed:', error)
        return NextResponse.json({
            error: "Bulk resolution failed",
            details: error.message
        }, { status: 500 })
    }
}
