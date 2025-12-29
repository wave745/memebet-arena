import { Connection, PublicKey } from "@solana/web3.js"
import * as anchor from "@coral-xyz/anchor"
import { getProgram, getMarketPda, PROGRAM_ID } from "./program"
import type { MemebetArena } from "../../target/types/memebet_arena"

export interface MarketData {
  marketId: number
  marketPda: PublicKey
  tokenMint: PublicKey
  targetMarketCap: anchor.BN
  endTimestamp: anchor.BN
  resolved: boolean
  outcome: boolean | null // true = YES won, false = NO won, null = not resolved
  finalMarketCap: anchor.BN | null
  yesPool: anchor.BN
  noPool: anchor.BN
  creator: PublicKey
}

export async function fetchAllMarkets(
  connection: Connection,
  wallet: anchor.Wallet
): Promise<MarketData[]> {
  const program = getProgram(connection, wallet)

  // Note: This is a simplified approach. In production, you'd use an indexer
  // or scan PDAs. For now, we'll need to know market IDs or scan.
  // This is a placeholder - implement based on your indexing strategy.

  const markets: MarketData[] = []

  // Example: If you have a known range of market IDs
  // For now, return empty - will be populated by indexer
  return markets
}

// Fetch market by PDA (chain-first, no calculations)
// Uses direct account parsing to avoid IDL account size issues
export async function fetchMarketByPda(
  connection: Connection,
  wallet: anchor.Wallet | null, // Can be null for read-only
  marketPda: PublicKey
): Promise<MarketData | null> {
  try {
    // Parse account data directly (no Anchor Program needed for read-only)
    const accountInfo = await connection.getAccountInfo(marketPda)
    if (!accountInfo) return null

    // accountInfo.data is Uint8Array in browser
    const data = accountInfo.data

    // Validate minimum size
    if (data.length < 106) {
      console.error(`Market account too small: ${data.length} bytes`)
      return null
    }

    // Helper to read u64 (8 bytes, little-endian) from Uint8Array
    const readU64LE = (offset: number): bigint => {
      let result = BigInt(0)
      for (let i = 0; i < 8; i++) {
        result |= BigInt(data[offset + i]) << BigInt(i * 8)
      }
      return result
    }

    // Helper to read i64 (8 bytes, little-endian, signed) from Uint8Array
    const readI64LE = (offset: number): bigint => {
      const unsigned = readU64LE(offset)
      // Convert to signed: if MSB is set, it's negative
      if (unsigned & (BigInt(1) << BigInt(63))) {
        return unsigned - (BigInt(1) << BigInt(64))
      }
      return unsigned
    }

    // Structure: 8 (discriminator) + 32 (creator) + 32 (token_mint) + 8 (target) + 8 (end) + 8 (yes) + 8 (no) + 1 (resolved) + 1-2 (outcome)
    const tokenMint = new PublicKey(data.slice(40, 72))

    // Read u64 values (8 bytes, little-endian)
    const targetMarketCap = readU64LE(72)
    const endTimestamp = readI64LE(80)
    const yesPool = readU64LE(88)
    const noPool = readU64LE(96)

    const resolved = data[104] === 1
    // Outcome: 0 = None, 1 = Some(false), 2 = Some(true) (but we only wrote 1 byte, so check)
    const outcomeByte = data[105]
    const outcome = outcomeByte === 0 ? null : outcomeByte === 1 ? false : true

    return {
      marketId: 0, // Not used with PDA-based markets
      marketPda,
      tokenMint,
      targetMarketCap: new anchor.BN(targetMarketCap.toString()),
      endTimestamp: new anchor.BN(endTimestamp.toString()),
      resolved,
      outcome,
      finalMarketCap: null,
      yesPool: new anchor.BN(yesPool.toString()),
      noPool: new anchor.BN(noPool.toString()),
      creator: new PublicKey(data.slice(8, 40)),
    }
  } catch (error) {
    console.error(`Failed to fetch market ${marketPda.toString()}:`, error)
    return null
  }
}

// Legacy function - kept for compatibility
export async function fetchMarket(
  connection: Connection,
  wallet: anchor.Wallet,
  marketId: number
): Promise<MarketData | null> {
  // This is deprecated - use fetchMarketByPda instead
  return null
}

export async function fetchUserPositions(
  connection: Connection,
  wallet: anchor.Wallet,
  user: PublicKey
): Promise<any[]> {
  const program = getProgram(connection, wallet)

  // Fetch all position accounts for a user
  // This requires scanning or using an indexer
  // Placeholder implementation
  return []
}

export async function createMarket(
  connection: Connection,
  wallet: anchor.Wallet,
  tokenMint: PublicKey,
  targetMarketCap: anchor.BN,
  endTimestamp: anchor.BN
): Promise<string> {
  const program = await getProgram(connection, wallet)
  const [marketPda, bump] = getMarketPda(tokenMint, targetMarketCap, endTimestamp)

  const tx = await program.methods
    .createMarket(tokenMint, targetMarketCap, endTimestamp, bump)
    .accounts({
      market: marketPda,
      creator: wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc()

  return tx
}


