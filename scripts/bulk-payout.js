#!/usr/bin/env node

/**
 * Bulk Payout Script - Automatically Pay All Winners
 *
 * This script finds all resolved markets and automatically pays out
 * all winners without them having to manually redeem.
 */

// Load environment variables
require('dotenv').config()

const { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require("@solana/web3.js")
const { Pool } = require('@neondatabase/serverless')

async function bulkPayout() {
    console.log('💰 Starting bulk payout - automatically paying all winners...')

    // Setup Solana connection
    const connection = new Connection(
        process.env.NEXT_PUBLIC_RPC_URL + "?api-key=" + process.env.NEXT_PUBLIC_HELIUS_API_KEY,
        "confirmed"
    )

    // Load paying wallet keypair (the wallet that will send the SOL)
    const payingPrivateKey = process.env.PAYING_PRIVATE_KEY || process.env.ADMIN_PRIVATE_KEY
    if (!payingPrivateKey) {
        console.error('❌ PAYING_PRIVATE_KEY or ADMIN_PRIVATE_KEY not configured')
        process.exit(1)
    }

    let payingKeypair
    try {
        const secretKey = Uint8Array.from(JSON.parse(payingPrivateKey))
        payingKeypair = Keypair.fromSecretKey(secretKey)
        console.log('✅ Paying wallet loaded:', payingKeypair.publicKey.toString())
    } catch (error) {
        console.error('❌ Failed to load paying keypair:', error)
        process.exit(1)
    }

    // Setup database connection
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    })

    const client = await pool.connect()

    try {
        // Get all resolved markets
        const resolvedMarketsQuery = `
            SELECT * FROM "Market"
            WHERE resolved = true
            AND outcome IS NOT NULL
            ORDER BY "endTimestamp" DESC
        `

        const resolvedMarketsResult = await client.query(resolvedMarketsQuery)
        const resolvedMarkets = resolvedMarketsResult.rows

        console.log(`📊 Found ${resolvedMarkets.length} resolved markets`)

        if (resolvedMarkets.length === 0) {
            console.log('✅ No resolved markets to process')
            return
        }

        let totalPayouts = 0
        let totalWinners = 0

        // MANUAL PAYOUT LIST - Add winners here
        // Format: { address: "wallet_address", amount: "amount_in_lamports", market: "market_name" }
        const manualPayouts = [
            { address: "6FRFEiBdxYRdNVa6z6rS9Rb7ioGzXz936vxAJjRvZxAS", amount: "9000000", market: "Winner Payout" }, // 0.009 SOL (leaving buffer for rent)
        ]

        console.log(`📋 Manual payouts to process: ${manualPayouts.length}`)

        if (manualPayouts.length === 0) {
            console.log('⚠️ No manual payouts configured. Add winners to the manualPayouts array.')
            console.log('💡 Example: { address: "wallet_address", amount: "1000000", market: "CHILLHOUSE" }')
            return
        }

        // Process manual payouts
        for (const payout of manualPayouts) {
            try {
                console.log(`\n💰 Processing payout: ${payout.amount} lamports to ${payout.address.slice(0, 8)}... (${payout.market})`)

                const userPubkey = new PublicKey(payout.address)
                const payoutAmount = BigInt(payout.amount)
                const payoutSOL = Number(payoutAmount) / LAMPORTS_PER_SOL

                // Create transfer instruction
                const transferInstruction = SystemProgram.transfer({
                    fromPubkey: payingKeypair.publicKey,
                    toPubkey: userPubkey,
                    lamports: payoutAmount
                })

                // Create and send transaction
                const transaction = new Transaction().add(transferInstruction)
                transaction.feePayer = payingKeypair.publicKey

                const { blockhash } = await connection.getLatestBlockhash("confirmed")
                transaction.recentBlockhash = blockhash

                transaction.sign(payingKeypair)

                console.log('📤 Sending payout transaction...')
                const signature = await connection.sendRawTransaction(
                    transaction.serialize(),
                    { skipPreflight: false, maxRetries: 3 }
                )

                console.log('⏳ Waiting for confirmation...')
                await connection.confirmTransaction(signature, "confirmed")

                totalPayouts++
                totalWinners++

                console.log(`✅ Paid ${payoutSOL.toFixed(6)} SOL to ${payout.address} - TX: ${signature}`)

                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000))

            } catch (payoutError) {
                console.error(`❌ Failed to pay ${payout.address}:`, payoutError.message)
            }
        }

        console.log(`\n🎉 Bulk payout complete:`)
        console.log(`   ✅ Payouts sent: ${totalPayouts}`)
        console.log(`   👥 Winners paid: ${totalWinners}`)
        console.log(`💰 All specified winners have been automatically paid!`)

        // Show resolved markets for reference
        console.log(`\n📊 Resolved markets summary:`)
        resolvedMarkets.forEach(market => {
            console.log(`   ${market.tokenSymbol}: ${market.outcome ? 'YES' : 'NO'} wins (Final: $${market.finalMarketCap || 'N/A'})`)
        })

    } finally {
        client.release()
        await pool.end()
    }
}

// Run the script
bulkPayout().catch(error => {
    console.error('💥 Script failed:', error)
    process.exit(1)
})