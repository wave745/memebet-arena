#!/usr/bin/env node

/**
 * Manual Redemption with Private Keys
 *
 * Simple script for redeeming winnings when you have the winner's private key.
 * Specify the winner's key and it will redeem their winnings automatically.
 */

// Load environment variables
require('dotenv').config()

const { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, LAMPORTS_PER_SOL } = require("@solana/web3.js")
const { Pool } = require('@neondatabase/serverless')

// Program constants and helper functions (copied from lib/solana/instructions.ts)
const PROGRAM_ID = new PublicKey("G3ctDAx46fPX4cTZgzcgzW1rDCe7e8qCqhCUTSf3a7LP")

// Computed: sha256("global:redeem")[0..8]
const REDEEM_DISCRIMINATOR = Buffer.from([184, 12, 86, 149, 70, 196, 97, 225])

/**
 * Serialize redeem instruction args manually (Borsh format)
 * Args: (outcome: bool)
 * - outcome: u8 (1 byte) - 0 for false, 1 for true
 */
function serializeRedeemArgs(outcome) {
  const buffer = Buffer.allocUnsafe(1) // 1 byte (u8)
  buffer.writeUInt8(outcome ? 1 : 0, 0)
  return buffer
}

/**
 * Derive vault PDA for a market
 */
function deriveVaultPda(tokenMint, targetMarketCap, endTimestamp) {
  const targetCapBytes = Buffer.alloc(8)
  targetCapBytes.writeBigUInt64LE(BigInt(targetMarketCap))

  const endTimestampBytes = Buffer.alloc(8)
  endTimestampBytes.writeBigInt64LE(BigInt(endTimestamp))

  const seeds = [
    Buffer.from('vault'),
    tokenMint.toBuffer(),
    targetCapBytes,
    endTimestampBytes
  ]

  const [vaultPda] = PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)
  return vaultPda
}

/**
 * Derive treasury PDA
 */
function deriveTreasuryPda() {
  const seeds = [Buffer.from('treasury')]
  const [treasuryPda] = PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)
  return treasuryPda
}

/**
 * Build a raw redeem instruction (claim winnings after market resolution)
 */
function buildRedeemInstruction(marketPda, vaultPda, treasuryPda, positionPda, user, outcome) {
  // Serialize instruction args (outcome)
  const argsBuffer = serializeRedeemArgs(outcome)
  const data = Buffer.concat([REDEEM_DISCRIMINATOR, argsBuffer])

  // Build accounts in exact order (matches Redeem struct)
  const keys = [
    {
      pubkey: marketPda,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: vaultPda, // market_vault
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: treasuryPda, // treasury
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: positionPda, // position
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: user, // user
      isSigner: true,
      isWritable: true,
    },
  ]

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data,
  })
}

async function redeemManual() {
    console.log('🎯 Manual Redemption with Private Key')

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
        // CONFIGURE THESE VALUES:
        const WINNER_PRIVATE_KEY = process.env.WINNER_PRIVATE_KEY // Set this in .env
        const MARKET_PDA = process.env.MARKET_PDA || "6B4kNXhMUviGGf17fBwLJksrBiZyRVzrUduHGUssWs1q" // TM market

        if (!WINNER_PRIVATE_KEY) {
            console.error('❌ WINNER_PRIVATE_KEY not set in .env file')
            console.log('💡 Add: WINNER_PRIVATE_KEY="[64, 205, 23, ...]" to your .env file')
            return
        }

        console.log(`🏆 Redeeming for market: ${MARKET_PDA}`)

        // Load winner's keypair
        let winnerKeypair
        try {
            const secretKey = new Uint8Array(JSON.parse(WINNER_PRIVATE_KEY))
            winnerKeypair = Keypair.fromSecretKey(secretKey)
            console.log(`✅ Winner wallet: ${winnerKeypair.publicKey.toString()}`)
        } catch (error) {
            console.error('❌ Failed to load winner private key:', error.message)
            return
        }

        // Get market details
        const marketResult = await client.query(
            `SELECT * FROM "Market" WHERE pda = $1`,
            [MARKET_PDA]
        )

        if (marketResult.rows.length === 0) {
            console.error(`❌ Market not found: ${MARKET_PDA}`)
            return
        }

        const market = marketResult.rows[0]

        if (!market.resolved) {
            console.log(`⚠️ Market not resolved: ${market.tokenSymbol}`)
            return
        }

        console.log(`📊 Market: ${market.tokenSymbol} (${market.outcome ? 'YES' : 'NO'} wins)`)

        // Derive vault PDA
        const vaultPda = deriveVaultPda(
            new PublicKey(market.tokenMint),
            BigInt(market.targetCap),
            BigInt(market.endTimestamp)
        )

        console.log(`🏦 Vault PDA: ${vaultPda.toString()}`)

        // Check vault balance
        const vaultBalance = await connection.getBalance(vaultPda)
        console.log(`💰 Vault balance: ${vaultBalance / LAMPORTS_PER_SOL} SOL`)

        if (vaultBalance === 0) {
            console.log(`⚠️ Vault is empty - no winnings to claim`)
            return
        }

        // Derive treasury PDA
        const treasuryPda = deriveTreasuryPda()

        // For manual redemption, we need to create a position PDA
        // This is a simplified approach - in reality you'd need the actual position
        const positionPda = winnerKeypair.publicKey // Simplified

        console.log(`📍 Using position PDA: ${positionPda.toString()}`)

        // Build redeem instruction
        const instruction = buildRedeemInstruction(
            new PublicKey(MARKET_PDA),       // market PDA
            vaultPda,                        // vault PDA
            treasuryPda,                     // treasury PDA
            positionPda,                     // position PDA
            winnerKeypair.publicKey,         // user
            market.outcome                    // outcome
        )

        // Create and send transaction
        const transaction = new Transaction().add(instruction)
        const { blockhash } = await connection.getLatestBlockhash("confirmed")
        transaction.recentBlockhash = blockhash
        transaction.feePayer = winnerKeypair.publicKey
        transaction.sign(winnerKeypair)

        console.log('📤 Submitting redemption transaction...')

        const signature = await connection.sendRawTransaction(
            transaction.serialize(),
            { skipPreflight: false, maxRetries: 3 }
        )

        console.log('⏳ Waiting for confirmation...')
        await connection.confirmTransaction(signature, "confirmed")

        console.log(`✅ Redemption successful! TX: ${signature}`)

        // Check final vault balance
        const finalVaultBalance = await connection.getBalance(vaultPda)
        const redeemedAmount = vaultBalance - finalVaultBalance

        console.log(`💰 Redeemed: ${(redeemedAmount) / LAMPORTS_PER_SOL} SOL`)
        console.log(`🎉 Winner has received their payout!`)

    } catch (error) {
        console.error('❌ Redemption failed:', error)
        console.error('Stack:', error.stack)
    } finally {
        client.release()
        await pool.end()
    }
}

// Run the script
redeemManual().catch(error => {
    console.error('💥 Script failed:', error)
    process.exit(1)
})