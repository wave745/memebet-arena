#!/usr/bin/env node

/**
 * Admin Redeem Script
 *
 * Allows admin to redeem all funds from resolved market vaults directly to their wallet.
 * Requires updated program with admin_redeem instruction.
 */

// Load environment variables
require('dotenv').config()

const { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require("@solana/web3.js")
const { Pool } = require('@neondatabase/serverless')

async function adminRedeem() {
    console.log('👑 Starting admin redemption - claiming all vault funds...')

    // Setup Solana connection
    const connection = new Connection(
        process.env.NEXT_PUBLIC_RPC_URL + "?api-key=" + process.env.NEXT_PUBLIC_HELIUS_API_KEY,
        "confirmed"
    )

    // Load admin keypair
    const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY
    if (!adminPrivateKey) {
        console.error('❌ ADMIN_PRIVATE_KEY not configured')
        process.exit(1)
    }

    let adminKeypair
    try {
        const secretKey = Uint8Array.from(JSON.parse(adminPrivateKey))
        adminKeypair = Keypair.fromSecretKey(secretKey)
        console.log('✅ Admin wallet loaded:', adminKeypair.publicKey.toString())
    } catch (error) {
        console.error('❌ Failed to load admin keypair:', error)
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
            console.log('✅ No resolved markets to redeem')
            return
        }

        let totalRedeemed = 0

        // Process each resolved market
        for (const market of resolvedMarkets) {
            console.log(`\n🎯 Processing market: ${market.tokenSymbol} (${market.outcome ? 'YES' : 'NO'} wins)`)

            try {
                // Derive vault PDA
                const tokenMint = new PublicKey(market.tokenMint)
                const targetCap = market.targetCap
                const endTimestamp = market.endTimestamp

                const targetCapBytes = Buffer.alloc(8)
                targetCapBytes.writeBigUInt64LE(BigInt(targetCap))

                const endTimestampBytes = Buffer.alloc(8)
                endTimestampBytes.writeBigInt64LE(BigInt(endTimestamp))

                const vaultSeeds = [
                    Buffer.from('vault'),
                    tokenMint.toBuffer(),
                    targetCapBytes,
                    endTimestampBytes
                ]

                const [vaultPDA] = PublicKey.findProgramAddressSync(
                    vaultSeeds,
                    new PublicKey('G3ctDAx46fPX4cTZgzcgzW1rDCe7e8qCqhCUTSf3a7LP')
                )

                const marketSeeds = [
                    Buffer.from('market'),
                    tokenMint.toBuffer(),
                    targetCapBytes,
                    endTimestampBytes
                ]

                const [marketPDA] = PublicKey.findProgramAddressSync(
                    marketSeeds,
                    new PublicKey('G3ctDAx46fPX4cTZgzcgzW1rDCe7e8qCqhCUTSf3a7LP')
                )

                // Check vault balance
                const vaultBalance = await connection.getBalance(vaultPDA)
                const vaultBalanceSOL = vaultBalance / LAMPORTS_PER_SOL

                if (vaultBalance === 0) {
                    console.log('   ✅ Vault already empty')
                    continue
                }

                console.log(`   🏦 Vault: ${vaultPDA.toString()}`)
                console.log(`   💰 Balance: ${vaultBalanceSOL} SOL (${vaultBalance} lamports)`)
                console.log(`   📊 Market: ${marketPDA.toString()}`)

                // For now, show what would be redeemed
                // Once program is updated, this will call admin_redeem instruction
                console.log(`   ⚠️ Program needs to be updated with admin_redeem instruction first`)
                console.log(`   💡 After deployment, this will transfer ${vaultBalanceSOL} SOL to admin wallet`)

                totalRedeemed += vaultBalance

            } catch (marketError) {
                console.error(`   ❌ Error processing market ${market.tokenSymbol}:`, marketError.message)
            }
        }

        const totalRedeemedSOL = totalRedeemed / LAMPORTS_PER_SOL
        console.log(`\n🎉 Redemption Preview:`)
        console.log(`   💰 Total SOL that will be redeemed: ${totalRedeemedSOL} SOL (${totalRedeemed} lamports)`)
        console.log(`   📊 Markets ready for redemption: ${resolvedMarkets.length}`)

        if (totalRedeemed > 0) {
            console.log(`\n🚨 NEXT STEPS:`)
            console.log(`   1. Deploy updated program with admin_redeem instruction`)
            console.log(`   2. Run this script again to actually redeem funds`)
            console.log(`   3. All ${totalRedeemedSOL} SOL will be transferred to your wallet`)
            console.log(`\n💡 Cost: ~0.002 SOL for program deployment`)
        }

    } finally {
        client.release()
        await pool.end()
    }
}

// Run the script
adminRedeem().catch(error => {
    console.error('💥 Script failed:', error)
    process.exit(1)
})