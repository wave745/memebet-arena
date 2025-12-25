import * as anchor from "@coral-xyz/anchor"
import { Connection, PublicKey } from "@solana/web3.js"

// IDL loading strategy:
// - Browser: Always fetch from /idl.json (public folder)
// - Server: Try static import, fallback to fetch
// This avoids require() in client bundle which breaks Turbopack

let idlStatic: any = null

// Only try require() on server-side (not in browser bundle)
if (typeof window === 'undefined' && typeof require !== 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const raw = require("./idl.json")
    // Handle wrapped IDL (some tools wrap it in { idl: {...} })
    idlStatic = raw.idl ?? raw
    
    // CRITICAL: Validate immediately
    if (!idlStatic || typeof idlStatic !== 'object' || Object.keys(idlStatic).length === 0) {
      console.error("❌ Static IDL is empty or invalid")
      idlStatic = null
    } else if (!idlStatic.name || !idlStatic.version) {
      console.error("❌ Static IDL missing name or version:", {
        hasName: !!idlStatic.name,
        hasVersion: !!idlStatic.version,
        keys: Object.keys(idlStatic),
        })
      idlStatic = null
    } else {
      console.log("✅ Static IDL loaded:", {
        name: idlStatic.name,
        version: idlStatic.version,
        instructions: idlStatic.instructions?.length,
        accounts: idlStatic.accounts?.length,
      })
    }
  } catch (e) {
    console.error("❌ Failed to require IDL:", e)
    idlStatic = null
  }
}

export const PROGRAM_ID = new PublicKey("6fQsRy2d91RaaHZrd9ymmaQuR4bWDL7x5hD6WqpdgLMV")

// Cache for runtime-fetched IDL
let idlCache: any = null
let idlFetchPromise: Promise<any> | null = null

async function fetchIdl(): Promise<any> {
  if (idlCache) {
    return idlCache
  }
  
  if (idlFetchPromise) {
    return idlFetchPromise
  }
  
  idlFetchPromise = (async () => {
    try {
      const response = await fetch('/idl.json')
      
      if (!response.ok) {
        throw new Error(`Failed to fetch IDL: ${response.status} ${response.statusText}`)
      }
      
      const text = await response.text()
      if (!text || text.trim() === '' || text === '{}') {
        throw new Error("Fetched IDL is empty")
      }
      
      const raw = JSON.parse(text)
      // Handle wrapped IDL (some tools wrap it in { idl: {...} })
      const idl = raw.idl ?? raw
      
      // CRITICAL: Validate immediately
      if (!idl || typeof idl !== 'object' || Object.keys(idl).length === 0) {
        throw new Error("Fetched IDL is empty or invalid")
      }
      
      if (!idl.version || !idl.name) {
        console.error("❌ Fetched IDL missing version or name:", {
          hasVersion: !!idl.version,
          hasName: !!idl.name,
          keys: Object.keys(idl),
        })
        throw new Error("Fetched IDL missing version or name")
      }
      
      console.log("✅ Fetched IDL loaded:", {
        name: idl.name,
        version: idl.version,
        instructions: idl.instructions?.length,
        accounts: idl.accounts?.length,
      })
      
      idlCache = idl
      return idlCache
    } catch (e) {
      idlFetchPromise = null
      throw new Error(`IDL fetch failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  })()
  
  return idlFetchPromise
}

export async function getProgram(connection: Connection, wallet: anchor.Wallet): Promise<anchor.Program<any>> {
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  })
  
  // Step 1: Get raw IDL
  let idl: any
  if (idlStatic && typeof idlStatic === 'object' && Object.keys(idlStatic).length > 0) {
    idl = idlStatic
  } else {
    idl = await fetchIdl()
  }
  
  // Step 2: Handle wrapped IDL
  if (idl.idl) {
    idl = idl.idl
  }
  
  // Step 3: CRITICAL - Log RAW IDL immediately (before any processing)
  console.log("RAW IDL CHECK:", {
    isObject: typeof idl === 'object',
    isEmpty: !idl || Object.keys(idl).length === 0,
    version: idl?.version,
    name: idl?.name,
    hasInstructions: Array.isArray(idl?.instructions),
    instructionCount: idl?.instructions?.length,
    hasAccounts: Array.isArray(idl?.accounts),
    accountCount: idl?.accounts?.length,
    accountNames: idl?.accounts?.map((a: any) => a?.name),
    hasTypes: Array.isArray(idl?.types),
    typeCount: idl?.types?.length,
    allKeys: idl ? Object.keys(idl) : 'null',
  })
  
  // Step 4: Validate RAW IDL (fail fast if invalid)
  if (!idl || typeof idl !== 'object' || Object.keys(idl).length === 0) {
    throw new Error("IDL is empty or invalid - check IDL file")
  }
  
  if (!idl.version || !idl.name) {
    console.error("❌ IDL missing required fields:", {
      hasVersion: !!idl.version,
      hasName: !!idl.name,
      version: idl.version,
      name: idl.name,
      allKeys: Object.keys(idl),
    })
    throw new Error("IDL missing version or name - use full generated IDL from target/idl/")
  }
  
  if (!idl.instructions || !Array.isArray(idl.instructions) || idl.instructions.length === 0) {
    throw new Error("IDL missing instructions array")
  }
  
  // Step 5: Clone IDL (don't mutate original)
  let idlCopy: any
  try {
    const idlString = JSON.stringify(idl)
    if (!idlString || idlString === '{}' || idlString.length < 10) {
      throw new Error("IDL stringify resulted in empty object")
    }
    idlCopy = JSON.parse(idlString)
    
    if (!idlCopy || typeof idlCopy !== 'object' || Object.keys(idlCopy).length === 0) {
      throw new Error("IDL clone is empty")
    }
  } catch (e) {
    console.error("❌ Failed to clone IDL:", e)
    console.error("Original IDL keys:", idl ? Object.keys(idl) : 'null')
    throw new Error(`Failed to clone IDL: ${e instanceof Error ? e.message : String(e)}`)
  }
  
  // Step 6: Ensure arrays exist
  if (!Array.isArray(idlCopy.accounts)) {
    idlCopy.accounts = []
  }
  if (!Array.isArray(idlCopy.types)) {
    idlCopy.types = []
  }
  
  // Step 7: Fix accounts (add type references and sizes)
  // CRITICAL: Filter out any invalid entries first, then process
  const validAccounts: any[] = []
  for (const acc of idlCopy.accounts) {
    // Skip null/undefined/invalid entries
    if (!acc || typeof acc !== 'object' || !acc.name || typeof acc.name !== 'string') {
      console.warn("Skipping invalid account entry:", acc)
      continue
    }
    
    // Create a clean account object with all required properties
    const cleanAcc: any = {
      name: acc.name,
      discriminator: acc.discriminator || [],
    }
    
    // Add type reference if matching type exists
    const matchingType = idlCopy.types.find((t: any) => t.name === acc.name)
    if (matchingType) {
      cleanAcc.type = acc.name
    }
    
    // Add size (required by Anchor)
    if (acc.name === "Market") {
      cleanAcc.size = 107 // 8 discriminator + 99 data
    } else if (acc.name === "Position") {
      cleanAcc.size = 82 // 8 discriminator + 74 data
    } else if (acc.size !== undefined) {
      cleanAcc.size = acc.size
    } else {
      // Unknown account without size - log warning but include it
      console.warn(`Account ${acc.name} has no size defined`)
      cleanAcc.size = 100 // Default fallback
    }
    
    validAccounts.push(cleanAcc)
  }
  
  // Replace accounts array with cleaned, valid accounts
  idlCopy.accounts = validAccounts
  
  // Step 8: Final validation before Program creation
  if (!idlCopy.version || !idlCopy.name || !Array.isArray(idlCopy.instructions)) {
    throw new Error("IDL structure is invalid after processing")
  }
  
  // CRITICAL: Validate all accounts have size (Anchor requires this)
  for (const acc of idlCopy.accounts) {
    if (!acc || typeof acc !== 'object') {
      throw new Error(`Invalid account entry in accounts array: ${JSON.stringify(acc)}`)
    }
    if (!acc.name || typeof acc.name !== 'string') {
      throw new Error(`Account missing name: ${JSON.stringify(acc)}`)
    }
    if (acc.size === undefined || typeof acc.size !== 'number' || acc.size <= 0) {
      throw new Error(`Account ${acc.name} missing valid size property. Current value: ${acc.size}`)
    }
  }
  
  // Step 9: Log final IDL before passing to Anchor
  console.log("FINAL IDL CHECK (before Anchor):", {
    version: idlCopy.version,
    name: idlCopy.name,
    hasAccounts: Array.isArray(idlCopy.accounts),
    accountCount: idlCopy.accounts?.length,
    accountDetails: idlCopy.accounts?.map((a: any) => ({
      name: a?.name,
      size: a?.size,
      type: a?.type,
      hasDiscriminator: Array.isArray(a?.discriminator),
    })),
      hasInstructions: Array.isArray(idlCopy.instructions),
    instructionCount: idlCopy.instructions?.length,
    hasTypes: Array.isArray(idlCopy.types),
    typeCount: idlCopy.types?.length,
    allKeys: Object.keys(idlCopy),
    })
  
  // Step 10: Create Program (old way, no cleverness)
  try {
    return new anchor.Program(idlCopy as anchor.Idl, provider, PROGRAM_ID) as anchor.Program<any>
  } catch (error: any) {
    console.error("❌ Failed to create Program:", error)
    console.error("Error message:", error?.message)
    console.error("Error stack:", error?.stack)
    console.error("IDL that failed:", {
      version: idlCopy?.version,
      name: idlCopy?.name,
      hasAccounts: Array.isArray(idlCopy?.accounts),
      accountCount: idlCopy?.accounts?.length,
      accountNames: idlCopy?.accounts?.map((a: any) => a?.name),
      hasInstructions: Array.isArray(idlCopy?.instructions),
      instructionCount: idlCopy?.instructions?.length,
      allKeys: idlCopy ? Object.keys(idlCopy) : 'null',
    })
    throw error
  }
}

export function getMarketPda(
  tokenMint: PublicKey,
  targetMarketCap: anchor.BN,
  endTimestamp: anchor.BN
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("market"),
      tokenMint.toBuffer(),
      targetMarketCap.toArrayLike(Buffer, "le", 8),
      endTimestamp.toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID
  )
}

export function getPositionPda(market: PublicKey, user: PublicKey, outcome: boolean): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position"), market.toBuffer(), user.toBuffer(), Buffer.from([outcome ? 1 : 0])],
    PROGRAM_ID
  )
}
