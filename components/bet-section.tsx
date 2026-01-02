"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { useWallet } from "./wallet-provider"
import { SolanaLogo } from "./solana-logo"
import { getPositionPda } from "@/lib/anchor/program"
import { buildPlaceBetInstruction } from "@/lib/solana/instructions"
import { PublicKey, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js"

interface BetSectionProps {
  side: "YES" | "NO"
  marketPda: PublicKey // Market PDA - required for betting
  onBetPlaced?: () => void
}

export function BetSection({ 
  side, 
  marketPda,
  onBetPlaced 
}: BetSectionProps) {
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [txSignature, setTxSignature] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { walletConnected, walletAddress, connection, wallet } = useWallet()

  // UI is a messenger - wallet signs, program rules, chain remembers
  const handleBet = async () => {
    // Reset error
    setError(null)

    // Validate wallet (must be connected to sign)
    if (!walletConnected || !walletAddress || !connection || !wallet) {
      setError("Connect your wallet first")
      return
    }

    // Basic UI validation (program will enforce real rules)
    const betAmount = Number.parseFloat(amount)
    if (!amount || betAmount <= 0 || isNaN(betAmount)) {
      setError("Enter a valid amount")
      return
    }

    // Disable button immediately (assume hostile user - prevent spam)
    setLoading(true)
    setSubmitted(true)

    try {
      const userPubkey = new PublicKey(walletAddress)
      
      // Convert SOL to lamports
      const amountLamports = BigInt(Math.floor(betAmount * LAMPORTS_PER_SOL))
      const outcome = side === "YES"
      
      // Derive position PDA: [b"position", market, user, outcome]
      const [positionPda] = getPositionPda(marketPda, userPubkey, outcome)

      // Step 1: Check balance FIRST (before building transaction - better UX)
      const balance = await connection.getBalance(userPubkey)
      const positionAccountRent = 1000000 // ~0.001 SOL for position account (82 bytes)
      const estimatedFee = 5000 // Transaction fee
      const totalRequired = amountLamports + BigInt(positionAccountRent) + BigInt(estimatedFee)
      
      if (BigInt(balance) < totalRequired) {
        const requiredSol = Number(totalRequired) / LAMPORTS_PER_SOL
        const currentSol = balance / LAMPORTS_PER_SOL
        throw new Error(
          `Insufficient balance. You need ${requiredSol.toFixed(4)} SOL ` +
          `(bet: ${betAmount} SOL + rent: ~0.001 SOL + fees), but you have ${currentSol.toFixed(4)} SOL.`
        )
      }
      
      // Step 2: Build raw instruction (no Anchor, no IDL, just Solana)
      // Note: Multiple buys on the same market are supported - the program handles it
      const instruction = buildPlaceBetInstruction(
        marketPda,
        positionPda,
        userPubkey,
        outcome,
        amountLamports
      )

      // Step 4: Build transaction
      const transaction = new Transaction().add(instruction)

      // Step 5: Get recent blockhash (required for transaction)
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed")
      transaction.recentBlockhash = blockhash
      transaction.feePayer = userPubkey

      // Step 6: Sign transaction (Phantom popup appears here)
      let signedTransaction: Transaction
      try {
        signedTransaction = await wallet.signTransaction(transaction)
      } catch (error: any) {
        // User rejected the transaction
        if (error?.message?.includes("reject") || error?.message?.includes("User rejected")) {
          setError(null) // Clear any previous errors
          setSubmitted(false) // Re-enable the form
          setLoading(false)
          return // User cancelled, don't show error
        }
        throw error // Re-throw other errors
      }
      setTxSignature(null) // Will be set after sending
      
      // Step 7: Send signed transaction
      // Note: Position account will be created by the program (init constraint)
      let signature: string
      try {
        signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        })
      } catch (error: any) {
        // Better error handling
        const logs = error?.logs || []
        const logString = logs.join("\n")
        
        // Check for specific errors
        if (logString.includes("already in use") || logString.includes("Allocate: account")) {
          throw new Error("You have already placed a bet on this market. Each user can only bet once per market.")
        }
        if (error?.message?.includes("debit") || error?.message?.includes("credit")) {
          throw new Error("Transaction failed: Insufficient balance or account creation failed.")
        }
        
        // Log full error for debugging
        console.error("Transaction failed:", {
          message: error?.message,
          logs: logs,
        })
        throw error
      }
      setTxSignature(signature)
      
      // Step 5: Wait for chain confirmation (program execution)
      // This is where the program actually:
      // - Validates market state
      // - Transfers SOL
      // - Creates position PDA
      // - Updates pools
      await connection.confirmTransaction(signature, "confirmed")
      
      // Step 6: Chain has finalized - bet exists forever
      // Now we can safely re-fetch market state (chain is truth)
      onBetPlaced?.()
      
    } catch (error: any) {
      console.error("Error placing bet:", error)
      
      // Parse error message
      let errorMsg = "Transaction failed"
      if (error.message) {
        if (error.message.includes("MarketResolved")) {
          errorMsg = "Market is already resolved"
        } else if (error.message.includes("MarketExpired")) {
          errorMsg = "Market has expired"
        } else if (error.message.includes("InvalidBetAmount")) {
          errorMsg = "Invalid bet amount"
        } else if (error.message.includes("ConstraintSeeds")) {
          errorMsg = "Position already exists (you already bet on this market)"
        } else {
          errorMsg = error.message.slice(0, 100)
        }
      }
      
      setError(errorMsg)
      setSubmitted(false) // Re-enable on error
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border border-border p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold">{side}</h3>
          <p className="text-xs text-muted-foreground">Place your bet</p>
        </div>

        {error && (
          <div className="rounded bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-500">
            {error}
          </div>
        )}

        {!submitted ? (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Amount (SOL)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.1"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value)
                  setError(null) // Clear error on input change
                }}
                className="bg-background text-foreground"
                disabled={loading || !walletConnected}
              />
            </div>

            <Button
              onClick={handleBet}
              disabled={loading || !amount || !walletConnected || submitted}
              className="w-full bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
            >
              {loading ? "Processing..." : `Bet ${side}`}
            </Button>
          </>
        ) : (
          <div className="rounded bg-background/50 p-4 text-center space-y-2">
            {txSignature ? (
              <>
                <p className="text-sm font-semibold text-foreground flex items-center gap-1">
                  Transaction submitted: {side} <SolanaLogo size={14} />{amount}
                </p>
                <a
                  href={`https://solscan.io/tx/${txSignature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground underline block"
                >
                  View on Solscan
                </a>
                <p className="text-xs text-muted-foreground">
                  Waiting for chain confirmation...
                </p>
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Wallet signing...</p>
                <p className="text-xs text-muted-foreground">
                  Approve the transaction in your wallet
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
