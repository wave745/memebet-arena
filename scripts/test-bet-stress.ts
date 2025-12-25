import * as anchor from "@coral-xyz/anchor"
import { PublicKey, Keypair } from "@solana/web3.js"
import BN from "bn.js"

// Set provider
anchor.setProvider(anchor.AnchorProvider.env())
const provider = anchor.getProvider()
const program = anchor.workspace.MemebetArena as any

// Stress test: Multiple wallets, same market, rapid-fire
async function stressTest() {
  console.log("🔥 Stress testing bet flow with multiple wallets...\n")

  const wallet = provider.wallet as anchor.Wallet
  const connection = provider.connection
  console.log(`Program ID: ${program.programId.toString()}`)
  console.log(`Primary wallet: ${wallet.publicKey.toString()}\n`)

  // Use the first market
  const tokenMint = new PublicKey("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263")
  const targetMarketCap = new BN(5_000_000_000)
  const endTimestamp = new BN(Math.floor(new Date("2026-06-30T23:59:59Z").getTime() / 1000))

  const [marketPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("market"),
      tokenMint.toBuffer(),
      targetMarketCap.toArrayLike(Buffer, "le", 8),
      endTimestamp.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  )

  console.log(`Market PDA: ${marketPda.toString()}\n`)

  // Create 3 test wallets
  const wallets = [wallet]
  for (let i = 0; i < 2; i++) {
    const newWallet = Keypair.generate()
    wallets.push({
      publicKey: newWallet.publicKey,
      signTransaction: async (tx: anchor.web3.Transaction) => {
        tx.sign(newWallet)
        return tx
      },
      signAllTransactions: async (txs: anchor.web3.Transaction[]) => {
        return txs.map((tx) => {
          tx.sign(newWallet)
          return tx
        })
      },
    } as anchor.Wallet)
    
    // Airdrop to test wallets
    try {
      const sig = await connection.requestAirdrop(newWallet.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL)
      await connection.confirmTransaction(sig)
      console.log(`Created test wallet ${i + 1}: ${newWallet.publicKey.toString()}`)
    } catch (error) {
      console.log(`⚠️  Could not airdrop to wallet ${i + 1} (rate limit?)`)
    }
  }

  // Test: Each wallet places one bet (different outcomes)
  console.log("\n🧪 Stress Test: Multiple wallets, same market, different outcomes\n")
  
  const outcomes = [true, false, true] // YES, NO, YES
  const amounts = [0.05, 0.1, 0.02] // Different amounts

  for (let i = 0; i < wallets.length; i++) {
    const testWallet = wallets[i]
    const outcome = outcomes[i]
    const amount = amounts[i]
    const amountLamports = new BN(amount * anchor.web3.LAMPORTS_PER_SOL)

    try {
      const [positionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), marketPda.toBuffer(), testWallet.publicKey.toBuffer()],
        program.programId
      )

      // Check if position exists
      const positionInfo = await connection.getAccountInfo(positionPda)
      if (positionInfo) {
        console.log(`  Wallet ${i + 1}: Position already exists, skipping...`)
        continue
      }

      // Create program with test wallet
      const testProvider = new anchor.AnchorProvider(connection, testWallet, {
        commitment: "confirmed",
      })
      const testProgram = new anchor.Program(program.idl, program.programId, testProvider)

      const tx = await testProgram.methods
        .placeBet(outcome, amountLamports)
        .accounts({
          market: marketPda,
          position: positionPda,
          marketEscrow: marketPda,
          user: testWallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc()

      console.log(`  ✅ Wallet ${i + 1} (${testWallet.publicKey.toString().slice(0, 8)}...): ${outcome ? "YES" : "NO"} ${amount} SOL`)
      console.log(`     TX: ${tx}`)
      
      await new Promise((resolve) => setTimeout(resolve, 1500))
    } catch (error: any) {
      console.log(`  ❌ Wallet ${i + 1} failed: ${error.message}`)
    }
  }

  // Verify final state
  console.log("\n📊 Final Market State:")
  const marketInfo = await connection.getAccountInfo(marketPda)
  console.log(`  Escrow balance: ${marketInfo?.lamports} lamports`)
  
  // Count positions
  let positionCount = 0
  for (const testWallet of wallets) {
    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), marketPda.toBuffer(), testWallet.publicKey.toBuffer()],
      program.programId
    )
    const posInfo = await connection.getAccountInfo(positionPda)
    if (posInfo) positionCount++
  }
  console.log(`  Active positions: ${positionCount}`)
  console.log(`\n✅ Stress test complete!`)
}

stressTest().catch(console.error)

