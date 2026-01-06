#!/usr/bin/env node

/**
 * Redeem Winnings Using Private Keys
 *
 * Allows redemption of winnings when you have the user's private key.
 * Useful for bulk redemptions or when users provide their keys for convenience.
 */

// Load environment variables
require('dotenv').config()

const { Connection, PublicKey, Keypair, Transaction, LAMPORTS_PER_SOL } = require("@solana/web3.js")
const { Pool } = require('@neondatabase/serverless')
const { buildRedeemInstruction, deriveVaultPda, deriveTreasuryPda } = require("../lib/solana/instructions")

async function redeemWithKeys() {
    console.log('🔑 Starting redemption with private keys...')

    // Setup Solana connection
    const connection = new Connection(
        process.env.NEXT_PUBLIC_RPC_URL + "?api-key=" + process.env.NEXT_PUBLIC_HELIUS_API_KEY,
        "confirmed"
    )

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

        // PRIVATE KEYS - Add winner private keys here
        // Format: { address: "wallet_address", privateKey: [64, byte, array], marketPda: "market_pda" }
        const winnerKeys = [
            // Example format:
            // {
            //   address: "7isqzPFUxGaEm4Jmv9rSHpLbEmVybdJYo7fgZeGdtWZk",
            //   privateKey: [64, 205, 23, ...], // full 64-byte private key array
            //   marketPda: "6B4kNXhMUviGGf17fBwLJksrBiZyRVzrUduHGUssWs1q"
            // },
            // Add winner private keys here...
        ]

        console.log(`🔑 Found ${winnerKeys.length} winner private keys to process`)

        if (winnerKeys.length === 0) {
            console.log('⚠️ No winner private keys provided. Add them to the winnerKeys array.')
            console.log('💡 Format: { address: "wallet", privateKey: [64,byte,array], marketPda: "market" }')
            return
        }

        let totalRedeemed = 0

        // Process each winner
        for (const winner of winnerKeys) {
            try {
                console.log(`\n🎯 Processing redemption for: ${winner.address.slice(0, 8)}...`)

                // Load winner's keypair
                const winnerKeypair = Keypair.fromSecretKey(new Uint8Array(winner.privateKey))
                console.log(`✅ Winner keypair loaded: ${winnerKeypair.publicKey.toString()}`)

                // Verify the address matches
                if (winnerKeypair.publicKey.toString() !== winner.address) {
                    console.error(`❌ Private key doesn't match address ${winner.address}`)
                    continue
                }

                // Get market details
                const marketResult = await client.query(
                    `SELECT * FROM "Market" WHERE pda = $1`,
                    [winner.marketPda]
                )

                if (marketResult.rows.length === 0) {
                    console.error(`❌ Market not found: ${winner.marketPda}`)
                    continue
                }

                const market = marketResult.rows[0]

                if (!market.resolved) {
                    console.log(`⚠️ Market not resolved yet: ${market.tokenSymbol}`)
                    continue
                }

                console.log(`📊 Market: ${market.tokenSymbol} (${market.outcome ? 'YES' : 'NO'} wins)`)

                // Find position for this user and market
                // Note: In a real system, you'd have position tracking
                // For now, we'll assume the winner has a position

                // Derive vault PDA
                const vaultPda = deriveVaultPda(
                    new PublicKey(market.tokenMint),
                    BigInt(market.targetCap),
                    BigInt(market.endTimestamp)
                )

                // For this demo, we'll create a mock position PDA
                // In reality, you'd need to know the actual position PDA
                const mockPositionPda = winnerKeypair.publicKey // Simplified

                console.log(`🏦 Vault PDA: ${vaultPda.toString()}`)
                console.log(`📍 Position PDA: ${mockPositionPda.toString()}`)

                // Check vault balance
                const vaultBalance = await connection.getBalance(vaultPda)
                if (vaultBalance === 0) {
                    console.log(`⚠️ Vault is empty: ${vaultPda.toString()}`)
                    continue
                }

                console.log(`💰 Available: ${vaultBalance / LAMPORTS_PER_SOL} SOL`)

                // Derive treasury PDA
                const treasuryPda = deriveTreasuryPda()

                // Build redeem instruction
                const instruction = buildRedeemInstruction(
                    new PublicKey(winner.marketPda), // market PDA
                    vaultPda,                        // vault PDA
                    treasuryPda,                     // treasury PDA
                    mockPositionPda,                 // position PDA
                    winnerKeypair.publicKey,         // user
                    market.outcome                    // outcome
                )

                // Create transaction
                const transaction = new Transaction().add(instruction)
                const { blockhash } = await connection.getLatestBlockhash("confirmed")
                transaction.recentBlockhash = blockhash
                transaction.feePayer = winnerKeypair.publicKey

                // Sign with winner's keypair
                transaction.sign(winnerKeypair)

                console.log('📤 Submitting redemption transaction...')

                // Send transaction
                const signature = await connection.sendRawTransaction(
                    transaction.serialize(),
                    { skipPreflight: false, maxRetries: 3 }
                )

                console.log('⏳ Waiting for confirmation...')
                await connection.confirmTransaction(signature, "confirmed")

                console.log(`✅ Redemption successful! TX: ${signature}`)

                // Check how much was redeemed
                const newVaultBalance = await connection.getBalance(vaultPda)
                const redeemedAmount = vaultBalance - newVaultBalance

                console.log(`💰 Redeemed: ${(redeemedAmount) / LAMPORTS_PER_SOL} SOL`)

                totalRedeemed += redeemedAmount

                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 2000))

            } catch (error) {
                console.error(`❌ Failed to redeem for ${winner.address}:`, error.message)
            }
        }

        const totalRedeemedSOL = totalRedeemed / LAMPORTS_PER_SOL
        console.log(`\n🎉 Redemption Summary:`)
        console.log(`   ✅ Total SOL redeemed: ${totalRedeemedSOL} SOL (${totalRedeemed} lamports)`)
        console.log(`   👥 Winners processed: ${winnerKeys.length}`)

        if (totalRedeemed > 0) {
            console.log(`\n💰 Funds have been automatically transferred to winner wallets!`)
        }

    } finally {
        client.release()
        await pool.end()
    }
}

// Run the script
redeemWithKeys().catch(error => {
    console.error('💥 Script failed:', error)
    process.exit(1)
})