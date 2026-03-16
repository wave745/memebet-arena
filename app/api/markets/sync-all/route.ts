import { NextResponse } from "next/server"
import { Pool } from '@neondatabase/serverless'

// Explicitly load dotenv for API routes
import 'dotenv/config'

export async function POST(request: Request) {
    try {
        console.log("Sync-all: Starting comprehensive market sync...")

        // Get markets from Neon database to see what's already there
        const dbUrl = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_DFs85ANlpHJC@ep-royal-paper-ahfywd90-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
        const pool = new Pool({
            connectionString: dbUrl,
        })

        const client = await pool.connect()
        console.log("Sync-all: Connected to database")
        
        // Setup Solana connection
        const { Connection, PublicKey } = await import('@solana/web3.js')
        const connection = new Connection(
            process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com",
            "confirmed"
        )
        const PROGRAM_ID = new PublicKey("ACBgFwUQrHYhfHRWFTowCLGg7FKMnth4Pi7JgHndYvWL")
        const MARKET_DISCRIMINATOR = Buffer.from([219, 190, 213, 55, 0, 227, 198, 154])
        
        // Discover markets from blockchain
        const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
            filters: [{ dataSize: 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 2 }]
        })
        
        console.log(`Sync-all: Found ${accounts.length} program accounts`)
        
        let syncedCount = 0
        let skippedCount = 0
        
        for (const { pubkey, account } of accounts) {
            try {
                // Check discriminator
                const discriminator = account.data.subarray(0, 8)
                if (!discriminator.equals(MARKET_DISCRIMINATOR)) continue
                
                let offset = 8 // Skip discriminator
                const creator = new PublicKey(account.data.subarray(offset, offset + 32))
                offset += 32
                const tokenMint = new PublicKey(account.data.subarray(offset, offset + 32))
                offset += 32
                const targetMarketCap = account.data.readBigUInt64LE(offset)
                offset += 8
                const endTimestamp = account.data.readBigInt64LE(offset)
                offset += 8
                const yesPool = account.data.readBigUInt64LE(offset)
                offset += 8
                const noPool = account.data.readBigUInt64LE(offset)
                offset += 8
                const resolved = account.data[offset] !== 0
                offset += 1
                
                let outcome = null
                if (account.data[offset] === 1) { // Some variant
                    offset += 1
                    outcome = account.data[offset] !== 0
                }
                
                // Get token metadata
                const mintString = tokenMint.toString()
                let symbol = mintString.slice(0, 6)
                let name = `Token ${symbol}`
                let image = null
                
                try {
                    const dexscreener = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${mintString}`).then(res => res.json())
                    if (dexscreener.pairs && dexscreener.pairs.length > 0) {
                        const pair = dexscreener.pairs[0]
                        symbol = pair.baseToken?.symbol || symbol
                        name = pair.baseToken?.name || name
                        if (pair.info?.imageUrl) image = pair.info.imageUrl
                    }
                } catch (e) {
                    // Ignore metadata fetch errors
                }
                
                // Upsert into DB
                const upsertQuery = `
                  INSERT INTO "Market" (
                    pda, "tokenMint", "tokenSymbol", "tokenName", "tokenImage",
                    "targetCap", "endTimestamp", resolved, outcome
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                  ON CONFLICT (pda) DO UPDATE SET
                    "tokenSymbol" = EXCLUDED."tokenSymbol",
                    "tokenName" = EXCLUDED."tokenName",
                    "tokenImage" = EXCLUDED."tokenImage",
                    resolved = EXCLUDED.resolved,
                    outcome = EXCLUDED.outcome
                  RETURNING *
                `
                await client.query(upsertQuery, [
                    pubkey.toString(),
                    mintString,
                    symbol,
                    name,
                    image,
                    targetMarketCap.toString(),
                    endTimestamp.toString(),
                    resolved,
                    outcome
                ])
                syncedCount++
            } catch (err) {
                console.error(`Sync-all: Failed to sync account ${pubkey.toString()}`, err)
                skippedCount++
            }
        }
        
        client.release()
        await pool.end()

        return NextResponse.json({
            success: true,
            message: "Market sync completed successfully",
            marketsCount: syncedCount,
            stats: {
                syncedMarkets: syncedCount,
                skippedMarkets: skippedCount
            }
        })

    } catch (error: any) {
        console.error("Sync-all failed:", error)
        return NextResponse.json({
            success: false,
            error: "Sync failed",
            details: error.message
        }, { status: 500 })
    }
}

// Also support GET for manual triggering (useful for testing)
export async function GET(request: Request) {
    return POST(request)
}