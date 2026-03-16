import { PublicKey, TransactionInstruction, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js"
import * as anchor from "@coral-xyz/anchor"
import { getMarketVaultPda } from "@/lib/anchor/program"

export const PROGRAM_ID = new PublicKey("ACBgFwUQrHYhfHRWFTowCLGg7FKMnth4Pi7JgHndYvWL")

// Instruction discriminators (first 8 bytes of sha256("global:instruction_name"))
// Computed: sha256("global:place_bet")[0..8]
const PLACE_BET_DISCRIMINATOR = Buffer.from([222, 62, 67, 220, 63, 166, 126, 33])
// Computed: sha256("global:redeem")[0..8]
const REDEEM_DISCRIMINATOR = Buffer.from([184, 12, 86, 149, 70, 196, 97, 225])
// Computed: sha256("global:sell_shares")[0..8]
const SELL_SHARES_DISCRIMINATOR = Buffer.from([184, 164, 169, 16, 231, 158, 199, 196])
// Computed: sha256("global:resolve_market")[0..8]
const RESOLVE_MARKET_DISCRIMINATOR = Buffer.from([155, 23, 80, 173, 46, 74, 23, 239])
// From IDL: create_market discriminator
const CREATE_MARKET_DISCRIMINATOR = Buffer.from([103, 226, 97, 235, 200, 188, 251, 254])

/**
 * Serialize place_bet instruction args manually (Borsh format)
 * Args: (outcome: bool, amount: u64)
 * - outcome: u8 (1 byte) - 0 for false, 1 for true
 * - amount: u64 (8 bytes, little-endian)
 */
function serializePlaceBetArgs(outcome: boolean, amount: bigint): Buffer {
  const buffer = Buffer.allocUnsafe(9) // 1 byte (u8) + 8 bytes (u64)
  
  // Write outcome as u8 (0 or 1)
  buffer.writeUInt8(outcome ? 1 : 0, 0)
  
  // Write amount as u64 little-endian (manual conversion)
  // Extract bytes from bigint in little-endian order
  let remaining = amount
  for (let i = 0; i < 8; i++) {
    buffer[1 + i] = Number(remaining & 0xffn)
    remaining = remaining >> 8n
  }
  
  return buffer
}

/**
 * Build a raw place_bet instruction
 *
 * Account order (must match PlaceBet struct in Rust):
 * 0. market (mut, Account<Market>)
 * 1. position (mut, init, Account<Position>, PDA seeds: [b"position", market, user])
 * 2. market_escrow (mut, UncheckedAccount - vault PDA)
 * 3. user (mut, signer)
 * 4. system_program (Program<System>)
 */
export function buildPlaceBetInstruction(
  marketPda: PublicKey,
  positionPda: PublicKey,
  user: PublicKey,
  outcome: boolean,
  amountLamports: bigint,
  tokenMint: PublicKey,
  targetMarketCap: anchor.BN | bigint,
  endTimestamp: anchor.BN | bigint
): TransactionInstruction {
  // Serialize instruction args (manual Borsh serialization)
  const argsBuffer = serializePlaceBetArgs(outcome, amountLamports)

  // Combine discriminator + args
  const data = Buffer.concat([PLACE_BET_DISCRIMINATOR, argsBuffer])

  // Convert to anchor.BN if needed
  const targetCapBN = targetMarketCap instanceof anchor.BN ? targetMarketCap : new anchor.BN(targetMarketCap.toString())
  const endTimeBN = endTimestamp instanceof anchor.BN ? endTimestamp : new anchor.BN(endTimestamp.toString())

  // Get the correct vault PDA for market_escrow
  const [marketVaultPda] = getMarketVaultPda(tokenMint, targetCapBN, endTimeBN)

  // Build accounts in exact order (matches PlaceBet struct)
  const keys = [
    {
      pubkey: marketPda,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: positionPda,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: marketVaultPda, // market_escrow is the vault PDA
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: user,
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
  ]
  
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data,
  })
}

/**
 * Serialize redeem instruction args manually (Borsh format)
 * Args: (outcome: bool)
 * - outcome: u8 (1 byte) - 0 for false, 1 for true
 */
function serializeRedeemArgs(outcome: boolean): Buffer {
  const buffer = Buffer.allocUnsafe(1) // 1 byte (u8)
  buffer.writeUInt8(outcome ? 1 : 0, 0)
  return buffer
}

/**
 * Derive vault PDA for a market
 */
export function deriveVaultPda(
  tokenMint: PublicKey,
  targetMarketCap: bigint,
  endTimestamp: bigint
): PublicKey {
  const targetCapBytes = Buffer.alloc(8)
  targetCapBytes.writeBigUInt64LE(targetMarketCap)

  const endTimestampBytes = Buffer.alloc(8)
  endTimestampBytes.writeBigInt64LE(endTimestamp)

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
export function deriveTreasuryPda(): PublicKey {
  const seeds = [Buffer.from('treasury')]
  const [treasuryPda] = PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)
  return treasuryPda
}

/**
 * Build a raw redeem instruction (claim winnings after market resolution)
 *
 * Account order (must match Redeem struct in Rust):
 * 0. market (mut, Account<Market>)
 * 1. market_vault (mut, SystemAccount - vault PDA)
 * 2. treasury (mut, Account<Treasury>)
 * 3. position (mut, Account<Position>)
 * 4. user (mut, signer)
 *
 * Args: (outcome: bool)
 */
export function buildRedeemInstruction(
  marketPda: PublicKey,
  vaultPda: PublicKey,
  treasuryPda: PublicKey,
  positionPda: PublicKey,
  user: PublicKey,
  outcome: boolean
): TransactionInstruction {
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

/**
 * Serialize sell_shares instruction args manually (Borsh format)
 * Args: (outcome: bool, amount_to_sell: u64)
 * - outcome: u8 (1 byte) - 0 for false, 1 for true
 * - amount_to_sell: u64 (8 bytes, little-endian)
 */
function serializeSellSharesArgs(outcome: boolean, amountToSell: bigint): Buffer {
  const buffer = Buffer.allocUnsafe(9) // 1 byte (u8) + 8 bytes (u64)
  
  // Write outcome as u8 (0 or 1)
  buffer.writeUInt8(outcome ? 1 : 0, 0)
  
  // Write amount as u64 little-endian (manual conversion)
  let remaining = amountToSell
  for (let i = 0; i < 8; i++) {
    buffer[1 + i] = Number(remaining & 0xffn)
    remaining = remaining >> 8n
  }
  
  return buffer
}

/**
 * Build a raw sell_shares instruction (sell position before market resolution)
 * 
 * Account order (must match SellShares struct in Rust):
 * 0. market (mut, Account<Market>, PDA with seeds constraint)
 * 1. position (mut, Account<Position>, has_one = user)
 * 2. user (mut, signer)
 * 3. system_program (Program<System>)
 */
export function buildSellSharesInstruction(
  marketPda: PublicKey,
  positionPda: PublicKey,
  user: PublicKey,
  outcome: boolean,
  amountToSellLamports: bigint
): TransactionInstruction {
  // Serialize instruction args (manual Borsh serialization)
  const argsBuffer = serializeSellSharesArgs(outcome, amountToSellLamports)
  
  // Combine discriminator + args
  const data = Buffer.concat([SELL_SHARES_DISCRIMINATOR, argsBuffer])
  
  // Build accounts in exact order (matches SellShares struct)
  const keys = [
    {
      pubkey: marketPda,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: positionPda,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: user,
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
  ]
  
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data,
  })
}

/**
 * Serialize resolve_market instruction args manually (Borsh format)
 * Args: (final_market_cap: u64)
 * - final_market_cap: u64 (8 bytes, little-endian)
 */
function serializeResolveMarketArgs(finalMarketCap: bigint): Buffer {
  const buffer = Buffer.allocUnsafe(8) // 8 bytes (u64)
  
  // Write amount as u64 little-endian (manual conversion)
  let remaining = finalMarketCap
  for (let i = 0; i < 8; i++) {
    buffer[i] = Number(remaining & 0xffn)
    remaining = remaining >> 8n
  }
  
  return buffer
}

/**
 * Build a raw resolve_market instruction
 * 
 * Account order (must match ResolveMarket struct in Rust):
 * 0. market (mut, Account<Market>)
 * 1. resolver (signer)
 */
export function buildResolveMarketInstruction(
  marketPda: PublicKey,
  resolver: PublicKey,
  finalMarketCap: bigint
): TransactionInstruction {
  // Serialize instruction args (manual Borsh serialization)
  const argsBuffer = serializeResolveMarketArgs(finalMarketCap)
  
  // Combine discriminator + args
  const data = Buffer.concat([RESOLVE_MARKET_DISCRIMINATOR, argsBuffer])
  
  // Build accounts in exact order (matches ResolveMarket struct)
  const keys = [
    {
      pubkey: marketPda,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: resolver,
      isSigner: true,
      isWritable: false,
    },
  ]

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data,
  })
}

/**
 * Serialize create_market instruction args manually (Borsh format)
 * Args: (token_mint: Pubkey, target_market_cap: u64, end_timestamp: i64, market_bump: u8, vault_bump: u8)
 * - token_mint: Pubkey (32 bytes)
 * - target_market_cap: u64 (8 bytes, little-endian)
 * - end_timestamp: i64 (8 bytes, little-endian)
 * - market_bump: u8 (1 byte)
 * - vault_bump: u8 (1 byte)
 */
function serializeCreateMarketArgs(
  tokenMint: PublicKey,
  targetMarketCap: bigint,
  endTimestamp: bigint,
  marketBump: number,
  vaultBump: number
): Buffer {
  const buffer = Buffer.allocUnsafe(32 + 8 + 8 + 1 + 1) // 32 + 8 + 8 + 1 + 1 = 50 bytes

  let offset = 0

  // Write token_mint (32 bytes)
  tokenMint.toBuffer().copy(buffer, offset)
  offset += 32

  // Write target_market_cap as u64 little-endian
  let remaining = targetMarketCap
  for (let i = 0; i < 8; i++) {
    buffer[offset + i] = Number(remaining & 0xffn)
    remaining = remaining >> 8n
  }
  offset += 8

  // Write end_timestamp as i64 little-endian
  remaining = endTimestamp
  for (let i = 0; i < 8; i++) {
    buffer[offset + i] = Number(remaining & 0xffn)
    remaining = remaining >> 8n
  }
  offset += 8

  // Write market_bump as u8
  buffer[offset] = marketBump
  offset += 1

  // Write vault_bump as u8
  buffer[offset] = vaultBump

  return buffer
}

/**
 * Build a raw create_market instruction
 *
 * Account order (must match CreateMarket struct in Rust):
 * 0. market (writable, Account<Market> - PDA to create)
 * 1. market_vault (writable, Account - PDA to create)
 * 2. creator (signer, writable)
 * 3. system_program (Program<System>)
 */
export function buildCreateMarketInstruction(
  marketPda: PublicKey,
  marketVaultPda: PublicKey,
  creator: PublicKey,
  tokenMint: PublicKey,
  targetMarketCap: bigint,
  endTimestamp: bigint,
  marketBump: number,
  vaultBump: number
): TransactionInstruction {
  const data = Buffer.concat([
    CREATE_MARKET_DISCRIMINATOR,
    serializeCreateMarketArgs(tokenMint, targetMarketCap, endTimestamp, marketBump, vaultBump)
  ])

  const keys = [
    {
      pubkey: marketPda,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: marketVaultPda,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: creator,
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
  ]

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data,
  })
}
