import { Connection, PublicKey } from "@solana/web3.js"
import { PROGRAM_ID } from "./instructions"

export interface PositionData {
  positionPda: PublicKey
  marketPda: PublicKey
  user: PublicKey
  outcome: boolean // true = YES, false = NO
  amount: bigint // in lamports
  claimed: boolean
}

/**
 * Fetch all Position accounts for a user
 * Uses getProgramAccounts to scan all positions
 */
export async function fetchUserPositions(
  connection: Connection,
  user: PublicKey
): Promise<PositionData[]> {
  try {
    // Position PDA seeds: [b"position", market, user]
    // We need to scan all positions where user matches
    // Since we can't filter by user in seeds, we'll use getProgramAccounts
    // and filter client-side
    
    const positions: PositionData[] = []
    
    // Get all Position accounts (this is expensive but necessary)
    // Position account size: 82 bytes (8 discriminator + 74 data)
    const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        {
          dataSize: 82, // Position account size
        },
      ],
    })
    
    // Decode each position and filter by user
    for (const account of accounts) {
      try {
        const data = account.account.data
        
        // Position structure (from Rust):
        // - 8 bytes: discriminator
        // - 32 bytes: market (Pubkey)
        // - 32 bytes: user (Pubkey)
        // - 1 byte: outcome (bool)
        // - 8 bytes: amount (u64)
        // - 1 byte: claimed (bool)
        
        if (data.length < 82) continue
        
        // Read user pubkey (offset 40, after discriminator + market)
        const userPubkey = new PublicKey(data.slice(40, 72))
        
        // Filter: only positions for this user
        if (!userPubkey.equals(user)) continue
        
        // Read market pubkey (offset 8, after discriminator)
        const marketPda = new PublicKey(data.slice(8, 40))
        
        // Read outcome (offset 72)
        const outcome = data[72] === 1
        
        // Read amount (offset 73, 8 bytes, little-endian)
        let amount = 0n
        for (let i = 0; i < 8; i++) {
          amount |= BigInt(data[73 + i]) << BigInt(i * 8)
        }
        
        // Read claimed (offset 81)
        const claimed = data[81] === 1
        
        positions.push({
          positionPda: account.pubkey,
          marketPda,
          user: userPubkey,
          outcome,
          amount,
          claimed,
        })
      } catch (e) {
        // Skip invalid accounts
        console.warn("Failed to decode position account:", account.pubkey.toString(), e)
        continue
      }
    }
    
    return positions
  } catch (error) {
    console.error("Failed to fetch user positions:", error)
    return []
  }
}


