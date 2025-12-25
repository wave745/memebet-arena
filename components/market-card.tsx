"use client"

import { useState, useEffect } from "react"
import { PublicKey, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js"
import * as anchor from "@coral-xyz/anchor"
import { useWallet } from "./wallet-provider"
import { getPositionPda } from "@/lib/anchor/program"
import { buildPlaceBetInstruction } from "@/lib/solana/instructions"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { SolanaLogo } from "./solana-logo"

interface MarketCardProps {
  pda: string
  tokenMint: string
  targetMarketCap: anchor.BN
  endTimestamp: anchor.BN
  resolved: boolean
  yesPool: anchor.BN
  noPool: anchor.BN
  outcome?: boolean | null
  onBetPlaced?: () => void
}

export function MarketCard({
  pda,
  tokenMint,
  targetMarketCap,
  endTimestamp,
  resolved,
  yesPool,
  noPool,
  outcome,
  onBetPlaced,
}: MarketCardProps) {
  const { walletConnected, walletAddress, connection, wallet } = useWallet()
  const [selectedSide, setSelectedSide] = useState<"YES" | "NO" | null>(null)
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [txSignature, setTxSignature] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  const yesPoolSol = Number(yesPool) / LAMPORTS_PER_SOL
  const noPoolSol = Number(noPool) / LAMPORTS_PER_SOL
  const totalPool = yesPoolSol + noPoolSol
  const yesPercent = totalPool > 0 ? (yesPoolSol / totalPool) * 100 : 50
  const noPercent = totalPool > 0 ? (noPoolSol / totalPool) * 100 : 50

  const resolveDate = new Date(Number(endTimestamp) * 1000)
  const now = new Date()
  const isClosingSoon = !resolved && (resolveDate.getTime() - now.getTime()) < 24 * 60 * 60 * 1000

  // Format question from token mint
  const question = `Will ${tokenMint.slice(0, 4)}...${tokenMint.slice(-4)} hit $${(Number(targetMarketCap) / 1_000_000_000).toFixed(1)}B?`

  const handleSideSelect = (side: "YES" | "NO") => {
    if (resolved) return
    if (!walletConnected) {
      // Could trigger wallet connect here
      return
    }
    setSelectedSide(side)
    setError(null)
    setAmount("")
  }

  const handleCloseBet = () => {
    setSelectedSide(null)
    setAmount("")
    setError(null)
    setSubmitted(false)
    setTxSignature(null)
  }

  const handleAmountQuickAdd = (add: number) => {
    const current = parseFloat(amount) || 0
    setAmount((current + add).toFixed(2))
  }

  const handleBet = async () => {
    if (!walletConnected || !walletAddress || !connection || !wallet) {
      setError("Connect your wallet first")
      return
    }

    const betAmount = parseFloat(amount)
    if (!amount || betAmount <= 0 || isNaN(betAmount)) {
      setError("Enter a valid amount")
      return
    }

    setLoading(true)
    setSubmitted(true)
    setError(null)

    try {
      const userPubkey = new PublicKey(walletAddress)
      const marketPda = new PublicKey(pda)
      
      // Determine outcome first
      const outcome = selectedSide === "YES"
      const [positionPda] = getPositionPda(marketPda, userPubkey, outcome)

      // Check balance first
      const balance = await connection.getBalance(userPubkey)
      const amountLamports = BigInt(Math.floor(betAmount * LAMPORTS_PER_SOL))
      const positionAccountRent = 1000000
      const estimatedFee = 5000
      const totalRequired = amountLamports + BigInt(positionAccountRent) + BigInt(estimatedFee)

      if (BigInt(balance) < totalRequired) {
        const requiredSol = Number(totalRequired) / LAMPORTS_PER_SOL
        const currentSol = balance / LAMPORTS_PER_SOL
        throw new Error(
          `Insufficient balance. You need ${requiredSol.toFixed(4)} SOL ` +
          `(bet: ${betAmount} SOL + rent: ~0.001 SOL + fees), but you have ${currentSol.toFixed(4)} SOL.`
        )
      }

      // Multiple buys on the same market are supported - the program handles it
      const instruction = buildPlaceBetInstruction(
        marketPda,
        positionPda,
        userPubkey,
        outcome,
        amountLamports
      )

      const transaction = new Transaction().add(instruction)
      const { blockhash } = await connection.getLatestBlockhash("confirmed")
      transaction.recentBlockhash = blockhash
      transaction.feePayer = userPubkey

      // Sign transaction
      let signedTransaction: Transaction
      try {
        signedTransaction = await wallet.signTransaction(transaction)
      } catch (error: any) {
        if (error?.message?.includes("reject") || error?.message?.includes("User rejected")) {
          setError(null)
          setSubmitted(false)
          setLoading(false)
          return
        }
        throw error
      }

      setTxSignature(null)

      // Send transaction
      let signature: string
      try {
        signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        })
      } catch (error: any) {
        const logs = error?.logs || []
        const logString = logs.join("\n")

        if (logString.includes("already in use") || logString.includes("Allocate: account")) {
          throw new Error("You have already placed a bet on this market.")
        }
        if (error?.message?.includes("debit") || error?.message?.includes("credit")) {
          throw new Error("Transaction failed: Insufficient balance or account creation failed.")
        }
        throw error
      }

      setTxSignature(signature)
      await connection.confirmTransaction(signature, "confirmed")

      // Success - reset and refresh
      onBetPlaced?.()
      handleCloseBet()
    } catch (error: any) {
      console.error("Error placing bet:", error)
      let errorMsg = "Transaction failed"
      if (error.message) {
        if (error.message.includes("MarketResolved")) {
          errorMsg = "Market is already resolved"
        } else if (error.message.includes("MarketExpired")) {
          errorMsg = "Market has expired"
        } else if (error.message.includes("InvalidBetAmount")) {
          errorMsg = "Invalid bet amount"
        } else {
          errorMsg = error.message.slice(0, 100)
        }
      }
      setError(errorMsg)
      setSubmitted(false)
    } finally {
      setLoading(false)
    }
  }

  // Calculate potential payout (simplified - shows what you'd win if you bet 1 SOL)
  const calculatePayout = (side: "YES" | "NO", betAmount: number) => {
    if (betAmount <= 0 || totalPool === 0) return 0
    const yourPool = side === "YES" ? yesPoolSol : noPoolSol
    const otherPool = side === "YES" ? noPoolSol : yesPoolSol
    if (yourPool === 0) return betAmount // If no one on your side, you get 1:1
    // Simplified: you get proportional share of other pool
    const totalAfterBet = yourPool + betAmount
    const yourShare = betAmount / totalAfterBet
    return betAmount + (otherPool * yourShare)
  }

  const betAmount = parseFloat(amount) || 0
  const potentialPayout = calculatePayout(selectedSide || "YES", betAmount)

  return (
    <div className="relative border border-border/30 bg-[#0F0F11] rounded-lg overflow-hidden transition-all duration-200 hover:border-border/50 hover:bg-[#121214] hover:shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
      {/* Status indicator */}
      {isClosingSoon && !resolved && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-amber-500/40 z-10" />
      )}

      {/* Error/Warning - floating at top, doesn't affect layout */}
      {error && (
        <div className="absolute top-4 left-4 right-4 z-40 text-xs text-white bg-red-600 border border-red-500 rounded px-2 py-1.5 leading-tight animate-in fade-in slide-in-from-top-2 pointer-events-auto">
          {error}
        </div>
      )}

      {/* Question - always visible at top, clickable */}
      <div className="relative z-30 px-3 sm:px-4 pt-3 sm:pt-4 pb-2 bg-[#0F0F11]">
        <h3 
          className="text-xs sm:text-sm font-medium text-[#E5E5E5] leading-tight cursor-pointer hover:text-[#E5E5E5]/80 transition-colors"
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.href = `/market/${pda}`
            }
          }}
        >
          {question}
        </h3>
      </div>

      {/* Main content area - gets covered by betting sheet */}
      <div className={`relative px-4 pb-4 transition-all duration-300 ${selectedSide ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
        {/* Resolve date */}
        <div className="text-xs text-[#8A8A8A] mb-4 font-mono pointer-events-none">
          Resolves {resolveDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </div>

        {/* Pools - pressure gauge style */}
        <div className="space-y-2 mb-4 pointer-events-none">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 flex-1">
              <span className="text-xs sm:text-sm font-medium text-[#6B9E78] min-w-[28px] sm:min-w-[32px]">YES</span>
              <span className="text-xs sm:text-sm font-mono text-[#D4D4D4] flex items-center gap-1">
                <SolanaLogo size={12} />
                {yesPoolSol.toFixed(2)}
              </span>
            </div>
            <span className="text-[10px] sm:text-xs font-mono text-[#8A8A8A] tabular-nums">
              {yesPercent.toFixed(0)}%
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 flex-1">
              <span className="text-xs sm:text-sm font-medium text-[#A67C7C] min-w-[28px] sm:min-w-[32px]">NO</span>
              <span className="text-xs sm:text-sm font-mono text-[#D4D4D4] flex items-center gap-1">
                <SolanaLogo size={12} />
                {noPoolSol.toFixed(2)}
              </span>
            </div>
            <span className="text-[10px] sm:text-xs font-mono text-[#8A8A8A] tabular-nums">
              {noPercent.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleSideSelect("YES")}
            disabled={resolved || !walletConnected}
            className="px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium text-[#6B9E78] border border-[#6B9E78]/20 rounded bg-[#6B9E78]/5 hover:bg-[#6B9E78]/10 hover:border-[#6B9E78]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            YES
          </button>
          <button
            onClick={() => handleSideSelect("NO")}
            disabled={resolved || !walletConnected}
            className="px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium text-[#A67C7C] border border-[#A67C7C]/20 rounded bg-[#A67C7C]/5 hover:bg-[#A67C7C]/10 hover:border-[#A67C7C]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            NO
          </button>
        </div>

        {/* Resolved indicator */}
        {resolved && (
          <div className="mt-3 pt-3 border-t border-border/20 pointer-events-none">
            <div className="text-xs text-[#6A6A6A] font-mono">
              {outcome === true ? "Resolved: YES" : outcome === false ? "Resolved: NO" : "Resolved"}
            </div>
          </div>
        )}
                  </div>

      {/* Betting Sheet - slides up from bottom - only visible when side is selected */}
      {selectedSide && (
                  <div
          className="absolute left-0 right-0 z-20 bg-[#0F0F11] border-t border-border/30 transition-all duration-300 ease-out overflow-y-auto scrollbar-hide animate-in slide-in-from-bottom"
                    style={{
            top: "calc(1.5rem + 1.25rem + 0.5rem)", // Start below question
            bottom: "0",
            maxHeight: "calc(100% - 4.5rem)",
          }}
        >
        <div className="px-4 py-3 space-y-2">
          {/* Header with close button */}
          <div className="flex items-center justify-between mb-0.5">
            <div className="text-sm font-medium text-[#E5E5E5]">
              Buy {selectedSide}
            </div>
            <button
              onClick={handleCloseBet}
              className="text-[#8A8A8A] hover:text-[#E5E5E5] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Amount input */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value)
                  setError(null)
                }}
                className="flex-1 bg-[#0B0B0D] border-border/30 text-[#E5E5E5] font-mono h-9 text-sm"
                disabled={loading || submitted}
              />
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAmountQuickAdd(1)}
                  className="text-xs h-9 px-2.5 bg-[#0B0B0D] border-border/30 text-[#8A8A8A] hover:text-[#E5E5E5]"
                  disabled={loading || submitted}
                >
                  +1
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAmountQuickAdd(10)}
                  className="text-xs h-9 px-2.5 bg-[#0B0B0D] border-border/30 text-[#8A8A8A] hover:text-[#E5E5E5]"
                  disabled={loading || submitted}
                >
                  +10
                </Button>
              </div>
            </div>


            {/* Transaction status - floating (only for submitted with signature) */}
            {submitted && !error && txSignature && (
              <div className="absolute top-16 left-6 right-6 z-30 text-xs text-[#8A8A8A] leading-tight animate-in fade-in slide-in-from-top-2">
                <div className="space-y-0.5 bg-[#0F0F11] border border-border/30 rounded px-2 py-1.5">
                  <div className="text-[#E5E5E5]">Transaction submitted</div>
                  <a
                    href={`https://solscan.io/tx/${txSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#6B9E78] hover:underline block"
                  >
                    View on Solscan
                  </a>
                </div>
              </div>
            )}

            {/* Buy button - with payout info inside */}
            <Button
              onClick={handleBet}
              disabled={loading || !amount || !walletConnected || submitted || resolved}
              className={`w-[92%] mx-auto font-medium py-2.5 text-sm mt-3 flex flex-col items-center gap-0.5 ${
                selectedSide === "YES"
                  ? "bg-[#6B9E78] hover:bg-[#6B9E78]/90 text-white"
                  : "bg-[#A67C7C] hover:bg-[#A67C7C]/90 text-white"
              }`}
            >
              <span>{loading ? "Processing..." : submitted ? "Submitted..." : `Buy ${selectedSide}`}</span>
              {betAmount > 0 && !loading && !submitted && (
                <span className="text-xs opacity-80 font-normal">
                  To win <span className="font-mono flex items-center gap-1 justify-center"><SolanaLogo size={12} />{potentialPayout.toFixed(2)}</span>
            </span>
              )}
            </Button>
          </div>
        </div>
        </div>
      )}
    </div>
  )
}
