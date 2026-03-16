#!/usr/bin/env node

/**
 * Test Bulk Resolution Logic Locally
 */

// Load environment variables from .env file
require('dotenv').config()

async function testBulkResolution() {
    console.log('🧪 Testing bulk resolution logic locally...')

    // Test database connection
    try {
        const { Pool } = require('@neondatabase/serverless')
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_DFs85ANlpHJC@ep-royal-paper-ahfywd90-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
        })

        const client = await pool.connect()
        console.log('✅ Database connected')

        // Check for expired markets
        const expiredMarketsQuery = `
            SELECT * FROM "Market"
            WHERE resolved = false
            AND "endTimestamp" < $1
            ORDER BY "endTimestamp" ASC
        `
        const now = Math.floor(Date.now() / 1000)
        console.log('🔍 Checking for markets expired before:', new Date(now * 1000).toISOString())

        const expiredMarketsResult = await client.query(expiredMarketsQuery, [now.toString()])
        const expiredMarkets = expiredMarketsResult.rows

        console.log(`📊 Found ${expiredMarkets.length} expired markets:`)

        if (expiredMarkets.length > 0) {
            expiredMarkets.forEach((market, i) => {
                console.log(`${i + 1}. ${market.tokenSymbol} - Expires: ${new Date(Number(market.endTimestamp) * 1000).toISOString()}`)
            })
        } else {
            console.log('❌ No expired markets found')
        }

        // Check total markets
        const totalMarketsQuery = 'SELECT COUNT(*) as count FROM "Market"'
        const totalResult = await client.query(totalMarketsQuery)
        console.log(`📊 Total markets in database: ${totalResult.rows[0].count}`)

        client.release()
        await pool.end()

    } catch (error) {
        console.error('❌ Database test failed:', error.message)
    }

    // Test admin key parsing
    try {
        const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY
        if (adminPrivateKey) {
            console.log('✅ ADMIN_PRIVATE_KEY found in environment')
            const secretKey = Uint8Array.from(JSON.parse(adminPrivateKey))
            console.log('✅ Admin key parsed successfully, length:', secretKey.length)
        } else {
            console.log('❌ ADMIN_PRIVATE_KEY not found')
        }
    } catch (error) {
        console.error('❌ Admin key parsing failed:', error.message)
    }
}

testBulkResolution();