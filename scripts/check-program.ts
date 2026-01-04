#!/usr/bin/env ts-node

/**
 * Check if the Anchor program exists on Solana
 */

import 'dotenv/config'
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js"

// Program ID from the code
const PROGRAM_ID = new PublicKey("ACBgFwUQrHYhfHRWFTowCLGg7FKMnth4Pi7JgHndYvWL")

async function checkProgram() {
  console.log("🔍 Checking program deployment status...")
  console.log(`Program ID: ${PROGRAM_ID.toString()}`)

  // Initialize connection using the same RPC logic as the frontend
  const getRpcUrl = () => {
    if (process.env.NEXT_PUBLIC_RPC_URL) {
      // If it's a Helius URL, ensure API key is included
      if (process.env.NEXT_PUBLIC_RPC_URL.includes('helius')) {
        // Check if API key is already in the URL
        if (process.env.NEXT_PUBLIC_RPC_URL.includes('api-key')) {
          return process.env.NEXT_PUBLIC_RPC_URL
        }
        // If not, add the API key
        if (process.env.NEXT_PUBLIC_HELIUS_API_KEY) {
          return `${process.env.NEXT_PUBLIC_RPC_URL}?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`
        }
      }
      return process.env.NEXT_PUBLIC_RPC_URL
    }
    return clusterApiUrl("mainnet-beta")
  }

  const rpcUrl = getRpcUrl()
  console.log("Using RPC URL:", rpcUrl)

  const connection = new Connection(rpcUrl, "confirmed")

  console.log(`RPC URL: ${connection.rpcEndpoint}`)

  let programFound = false

  try {
    // Check if program account exists
    console.log("\n📋 Checking program account...")
    console.log(`Looking for program: ${PROGRAM_ID.toString()}`)

    const programAccount = await connection.getAccountInfo(PROGRAM_ID)

    if (!programAccount) {
      console.log("❌ Program account not found!")
      console.log("This means the program is NOT deployed to this network.")
      return false
    }

    console.log("✅ Program account found!")
    console.log(`Owner: ${programAccount.owner.toString()}`)
    console.log(`Lamports: ${programAccount.lamports}`)
    console.log(`Data length: ${programAccount.data.length} bytes`)
    console.log(`Executable: ${programAccount.executable}`)

    // Check if it's owned by the BPF Loader (indicating it's a program)
    const BPF_LOADER_ID = new PublicKey("BPFLoader2111111111111111111111111111111111")
    const BPF_LOADER_UPGRADEABLE_ID = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111") // 43 chars

    console.log(`Expected BPF Loader: ${BPF_LOADER_UPGRADEABLE_ID.toString()}`)
    console.log(`Actual owner: ${programAccount.owner.toString()}`)

    if (programAccount.owner.equals(BPF_LOADER_ID) || programAccount.owner.equals(BPF_LOADER_UPGRADEABLE_ID)) {
      console.log("✅ Program is owned by BPF Loader (valid program)")
    } else {
      console.log(`⚠️  Program is owned by ${programAccount.owner.toString()} (not a standard program)`)
    }

    // Try to get program accounts (this is what the sync script does)
    console.log("\n📊 Checking for program accounts...")

    console.log("Market struct size:", 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 2)

    try {
      console.log("Trying dataSize filter...")
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          {
            dataSize: 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 2, // Market struct size
          }
        ]
      })

      console.log(`✅ Found ${accounts.length} accounts matching Market struct size`)

    } catch (error: any) {
      console.log(`❌ Error getting filtered accounts: ${error.message}`)
      console.log("Error details:", error)

      // Try with different filter
      try {
        console.log("Trying with memcmp filter...")
        const discriminator = Buffer.from([219, 190, 213, 55, 0, 227, 198, 154])
        console.log("Discriminator bytes:", discriminator)
        console.log("Discriminator base64:", discriminator.toString('base64'))

        const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
          filters: [
            {
              memcmp: {
                offset: 0,
                bytes: discriminator.toString('base64')
              }
            }
          ]
        })
        console.log(`Found ${accounts.length} accounts with discriminator filter`)
      } catch (error2: any) {
        console.log(`❌ Memcmp filter also failed: ${error2.message}`)
        console.log("Error2 details:", error2)
      }
    }

    // Also try without filters to see ALL accounts owned by this program
    console.log("\n🔍 Checking ALL program accounts (no filters)...")
    try {
      console.log("Calling getProgramAccounts without filters...")
      const allAccounts = await connection.getProgramAccounts(PROGRAM_ID)
      console.log(`✅ Total program accounts: ${allAccounts.length}`)

      if (allAccounts.length > 0) {
        console.log("All accounts:")
        allAccounts.forEach((acc, i) => {
          console.log(`  ${i + 1}. ${acc.pubkey.toString()} (${acc.account.data.length} bytes)`)

          // Check if this could be a Market account
          if (acc.account.data.length >= 100) { // Close to our expected size
            const discriminator = acc.account.data.subarray(0, 8)
            const expectedDiscriminator = Buffer.from([219, 190, 213, 55, 0, 227, 198, 154])
            const isMarket = discriminator.equals(expectedDiscriminator)
            console.log(`      -> ${isMarket ? 'MARKET' : 'Other'} account (${discriminator.toString('hex')})`)
          }
        })
      } else {
        console.log("ℹ️ No accounts owned by this program yet.")
        console.log("This is normal if no markets have been created yet.")
      }
    } catch (error: any) {
      console.log(`❌ Error getting all accounts: ${error.message}`)
      console.log("Error details:", error)
    }

    programFound = true
    return true

  } catch (error: any) {
    console.error("❌ Error checking program:", error.message)
    console.error("Error details:", error)

    if (error.message.includes("Invalid param")) {
      console.log("This might indicate the RPC endpoint is having issues")
    }

    return programFound
  }
}

// Run the check
if (import.meta.url === `file://${process.argv[1]}`) {
  checkProgram()
    .then(success => {
      console.log(`\n${success ? '✅' : '❌'} Program check ${success ? 'PASSED' : 'FAILED'}`)
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error("Check failed:", error)
      process.exit(1)
    })
}