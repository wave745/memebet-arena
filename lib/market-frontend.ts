import { Connection, PublicKey } from "@solana/web3.js"

// Frontend-only market reader - no Anchor dependencies
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
 * Fetch market data by PDA (frontend version)
 */
export async function fetchMarketByPdaFrontend(
  connection: Connection,
  marketPda: PublicKey
): Promise<FrontendMarketData | null> {
  try {
    console.log(`Fetching market account: ${marketPda.toString()}`)
    const accountInfo = await connection.getAccountInfo(marketPda)

    if (!accountInfo) {
      console.log(`Market account not found: ${marketPda.toString()}`)
      return null
    }

    console.log(`Account info: owner=${accountInfo.owner?.toString()}, space=${accountInfo.space}, data length=${accountInfo.data.length}`)

    const marketData = parseMarketAccount(accountInfo.data)
    if (marketData) {
      marketData.marketPda = marketPda
      return marketData
    }

    return null
  } catch (error: any) {
    console.error(`Failed to fetch market ${marketPda.toString()}:`, error.message || error)

    // Check if it's an RPC/network error
    if (error.message?.includes('Failed to fetch') || error.message?.includes('fetch')) {
      console.error('RPC endpoint may be unreachable. Check NEXT_PUBLIC_RPC_URL configuration.')
    }

    return null
  }
}