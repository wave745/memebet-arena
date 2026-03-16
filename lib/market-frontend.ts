import { Connection, PublicKey } from "@solana/web3.js"

// Frontend-only market reader - no Anchor dependencies
// Note: In production, this should be replaced with a proper API call
// For now, we'll simulate database fallback
export interface FrontendMarketData {
  marketPda: PublicKey
  tokenMint: PublicKey
  tokenSymbol: string
  tokenName: string
  tokenImage?: string
  targetMarketCap: bigint
  endTimestamp: bigint
  resolved: boolean
  outcome: boolean | null
  yesPool: bigint
  noPool: bigint
  creator: PublicKey
}

// Market account discriminator (first 8 bytes of sha256("account:Market"))
const MARKET_DISCRIMINATOR = Buffer.from([219, 190, 213, 55, 0, 227, 198, 154])

/**
 * Parse market account data from raw Solana account bytes
 */
export function parseMarketAccount(accountData: Uint8Array): FrontendMarketData | null {
  try {
    console.log(`Parsing account data, length: ${accountData.length}`)
    console.log(`Account data type: ${typeof accountData}, constructor: ${accountData.constructor.name}`)

    // Check discriminator
    const discriminator = accountData.subarray(0, 8)
    console.log(`Discriminator: ${Array.from(discriminator).map(b => b.toString(16).padStart(2, '0')).join('')}`)
    console.log(`Expected: ${Array.from(MARKET_DISCRIMINATOR).map(b => b.toString(16).padStart(2, '0')).join('')}`)

    if (!discriminator.every((byte, i) => byte === MARKET_DISCRIMINATOR[i])) {
      console.warn(`Invalid discriminator, not a market account`)
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
    const targetMarketCap = accountData.subarray(offset, offset + 8).reduce((acc, byte, i) => acc + (BigInt(byte) << BigInt(i * 8)), BigInt(0))
    offset += 8

    // end_timestamp: i64 (8 bytes, little-endian)
    const endTimestampBytes = accountData.subarray(offset, offset + 8)
    let endTimestamp = BigInt(0)
    for (let i = 0; i < 8; i++) {
      endTimestamp |= BigInt(endTimestampBytes[i]) << BigInt(i * 8)
    }
    // Convert to signed
    if (endTimestamp & (BigInt(1) << BigInt(63))) {
      endTimestamp = endTimestamp - (BigInt(1) << BigInt(64))
    }
    offset += 8

    // yes_pool: u64 (8 bytes, little-endian)
    const yesPool = accountData.subarray(offset, offset + 8).reduce((acc, byte, i) => acc + (BigInt(byte) << BigInt(i * 8)), BigInt(0))
    offset += 8

    // no_pool: u64 (8 bytes, little-endian)
    const noPool = accountData.subarray(offset, offset + 8).reduce((acc, byte, i) => acc + (BigInt(byte) << BigInt(i * 8)), BigInt(0))
    offset += 8

    // resolved: bool (1 byte) - should be 0 or 1
    const resolvedByte = accountData[offset]
    offset += 1

    // Validate resolved value (should be exactly 0 or 1)
    if (resolvedByte !== 0 && resolvedByte !== 1) {
      console.warn(`Invalid resolved byte: ${resolvedByte} (expected 0 or 1). On-chain data corrupted, using database fallback.`)
      return null // Trigger database fallback
    }

    const resolved = resolvedByte === 1

    // outcome: Option<bool> (1 byte enum discriminator + optional bool)
    let outcome: boolean | null = null
    const outcomeEnum = accountData[offset]
    offset += 1

    // Validate outcome enum (should be 0 for None, 1 for Some)
    if (outcomeEnum === 0) {
      // None - correct
      outcome = null
    } else if (outcomeEnum === 1) {
      // Some - check the bool value
      const outcomeBool = accountData[offset]
      if (outcomeBool === 0 || outcomeBool === 1) {
        outcome = outcomeBool !== 0
        offset += 1
      } else {
        console.warn(`Invalid outcome bool value: ${outcomeBool}, expected 0 or 1. Data corrupted, using database fallback.`)
        return null // Trigger database fallback
      }
    } else {
      console.warn(`Invalid outcome enum: ${outcomeEnum}, expected 0 or 1. Data corrupted, using database fallback.`)
      return null // Trigger database fallback
    }

    return {
      marketPda: PublicKey.default, // Will be set by caller
      tokenMint,
      tokenSymbol: 'UNKNOWN',
      tokenName: 'Unknown Token',
      tokenImage: undefined,
      targetMarketCap,
      endTimestamp,
      resolved,
      outcome,
      yesPool,
      noPool,
      creator
    }
  } catch (error) {
    console.warn("Failed to parse market account:", error)
    return null
  }
}

/**
 * Fetch market data from database API (fallback when on-chain data is corrupted)
 */
async function fetchMarketFromDatabase(marketPda: PublicKey): Promise<FrontendMarketData | null> {
  try {
    const response = await fetch(`/api/market/${marketPda.toString()}`)
    if (!response.ok) {
      return null
    }
    const data = await response.json()

    // Convert API response to FrontendMarketData format
    return {
      marketPda: new PublicKey(data.marketPda),
      tokenMint: new PublicKey(data.tokenMint),
      tokenSymbol: data.tokenSymbol,
      tokenName: data.tokenName,
      tokenImage: data.tokenImage,
      targetMarketCap: BigInt(data.targetMarketCap),
      endTimestamp: BigInt(data.endTimestamp),
      resolved: data.resolved,
      outcome: data.outcome,
      yesPool: BigInt(data.yesPool || 0),
      noPool: BigInt(data.noPool || 0),
      creator: new PublicKey(data.creator),
    }
  } catch (error) {
    console.warn('Failed to fetch market from database:', error)
    return null
  }
}

/**
 * Fetch market data by PDA (frontend version with database fallback)
 */
export async function fetchMarketByPdaFrontend(
  connection: Connection,
  marketPda: PublicKey
): Promise<FrontendMarketData | null> {
  try {
    console.log(`Fetching market account: ${marketPda.toString()}`)
    const accountInfo = await connection.getAccountInfo(marketPda)

    if (!accountInfo) {
      console.log(`Market account not found: ${marketPda.toString()}, trying database fallback`)
      return await fetchMarketFromDatabase(marketPda)
    }

    console.log(`Account info: owner=${accountInfo.owner?.toString()}, space=${accountInfo.space}, data length=${accountInfo.data.length}`)

    const marketData = parseMarketAccount(accountInfo.data)
    if (marketData) {
      // Additional validation: check if the data makes sense
      // If resolved is false but we know this market should be resolved, use database
      const dbData = await fetchMarketFromDatabase(marketPda)
      if (dbData && dbData.resolved && !marketData.resolved) {
        console.log(`On-chain shows unresolved but database shows resolved, using database data`)
        return dbData
      }

      marketData.marketPda = marketPda
      return marketData
    }

    console.log(`On-chain parsing failed, trying database fallback`)
    return await fetchMarketFromDatabase(marketPda)
  } catch (error: any) {
    console.error(`Failed to fetch market ${marketPda.toString()}:`, error.message || error)

    // Check if it's an RPC/network error
    if (error.message?.includes('Failed to fetch') || error.message?.includes('fetch')) {
      console.error('RPC endpoint may be unreachable. Check NEXT_PUBLIC_RPC_URL configuration.')
    }

    // Try database fallback
    console.log('Trying database fallback due to error')
    return await fetchMarketFromDatabase(marketPda)
  }
}