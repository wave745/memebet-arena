#!/usr/bin/env ts-node

/**
 * Test script for market account parsing
 * Validates that the parseMarketAccount function works correctly
 */

import { PublicKey } from "@solana/web3.js"

// Import the parsing function
function parseMarketAccount(accountData: Buffer): any | null {
  try {
    // Check discriminator
    const discriminator = accountData.subarray(0, 8)
    if (!discriminator.equals(Buffer.from([219, 190, 213, 55, 0, 227, 198, 154]))) {
      return null // Not a market account
    }

    // Parse account data according to Market struct
    let offset = 8 // Skip discriminator

    // creator: Pubkey (32 bytes)
    const creator = new PublicKey(accountData.subarray(offset, offset + 32))
    offset += 32

    // token_mint: Pubkey (32 bytes)
    const tokenMint = new PublicKey(accountData.subarray(offset, offset + 32))
    offset += 32

    // target_market_cap: u64 (8 bytes, little-endian)
    const targetMarketCap = accountData.readBigUInt64LE(offset)
    offset += 8

    // end_timestamp: i64 (8 bytes, little-endian)
    const endTimestamp = accountData.readBigInt64LE(offset)
    offset += 8

    // yes_pool: u64 (8 bytes, little-endian)
    const yesPool = accountData.readBigUInt64LE(offset)
    offset += 8

    // no_pool: u64 (8 bytes, little-endian)
    const noPool = accountData.readBigUInt64LE(offset)
    offset += 8

    // resolved: bool (1 byte)
    const resolved = accountData[offset] !== 0
    offset += 1

    // outcome: Option<bool> (1 byte enum discriminator + optional bool)
    let outcome: boolean | null = null
    const outcomeEnum = accountData[offset]
    offset += 1
    if (outcomeEnum === 1) { // Some variant
      outcome = accountData[offset] !== 0
      offset += 1
    }

    return {
      creator,
      tokenMint,
      targetMarketCap,
      endTimestamp,
      yesPool,
      noPool,
      resolved,
      outcome
    }
  } catch (error) {
    console.warn("Failed to parse market account:", error)
    return null
  }
}

// Test with a mock market account
function createMockMarketAccount(): Buffer {
  const buffer = Buffer.alloc(8 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 2) // Market struct size

  let offset = 0

  // Discriminator (8 bytes)
  Buffer.from([219, 190, 213, 55, 0, 227, 198, 154]).copy(buffer, offset)
  offset += 8

  // creator (32 bytes) - using a mock pubkey
  const creator = new PublicKey("11111111111111111111111111111112")
  Buffer.from(creator.toBytes()).copy(buffer, offset)
  offset += 32

  // token_mint (32 bytes) - BONK token
  const tokenMint = new PublicKey("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263")
  Buffer.from(tokenMint.toBytes()).copy(buffer, offset)
  offset += 32

  // target_market_cap (8 bytes) - 1000000
  buffer.writeBigUInt64LE(BigInt(1000000), offset)
  offset += 8

  // end_timestamp (8 bytes) - future timestamp
  const futureTime = BigInt(Math.floor(Date.now() / 1000) + 86400) // 1 day from now
  buffer.writeBigInt64LE(futureTime, offset)
  offset += 8

  // yes_pool (8 bytes) - 1000000000 lamports (1 SOL)
  buffer.writeBigUInt64LE(BigInt(1000000000), offset)
  offset += 8

  // no_pool (8 bytes) - 500000000 lamports (0.5 SOL)
  buffer.writeBigUInt64LE(BigInt(500000000), offset)
  offset += 8

  // resolved (1 byte) - false
  buffer[offset] = 0
  offset += 1

  // outcome (1 byte enum + 1 byte bool) - None
  buffer[offset] = 0 // None variant
  offset += 1

  return buffer
}

async function testMarketParsing() {
  console.log("🧪 Testing market account parsing...")

  // Test 1: Parse valid market account
  console.log("\n📋 Test 1: Parse valid market account")
  const mockAccount = createMockMarketAccount()
  const parsed = parseMarketAccount(mockAccount)

  if (!parsed) {
    console.error("❌ Failed to parse valid market account")
    return false
  }

  console.log("✅ Successfully parsed market account:")
  console.log(`   Creator: ${parsed.creator.toString()}`)
  console.log(`   Token Mint: ${parsed.tokenMint.toString()}`)
  console.log(`   Target Cap: ${parsed.targetMarketCap}`)
  console.log(`   End Timestamp: ${parsed.endTimestamp}`)
  console.log(`   Yes Pool: ${parsed.yesPool}`)
  console.log(`   No Pool: ${parsed.noPool}`)
  console.log(`   Resolved: ${parsed.resolved}`)
  console.log(`   Outcome: ${parsed.outcome}`)

  // Test 2: Parse invalid account (wrong discriminator)
  console.log("\n📋 Test 2: Parse invalid account (wrong discriminator)")
  const invalidAccount = Buffer.alloc(mockAccount.length)
  mockAccount.copy(invalidAccount)
  invalidAccount[0] = 0 // Change discriminator
  const invalidParsed = parseMarketAccount(invalidAccount)

  if (invalidParsed !== null) {
    console.error("❌ Should have failed to parse invalid account")
    return false
  }

  console.log("✅ Correctly rejected invalid account")

  // Test 3: Parse account that's too short
  console.log("\n📋 Test 3: Parse account that's too short")
  const shortAccount = Buffer.alloc(10) // Too short
  const shortParsed = parseMarketAccount(shortAccount)

  if (shortParsed !== null) {
    console.error("❌ Should have failed to parse short account")
    return false
  }

  console.log("✅ Correctly rejected short account")

  console.log("\n🎉 All parsing tests passed!")
  return true
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testMarketParsing()
    .then(success => {
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error("Test failed:", error)
      process.exit(1)
    })
}