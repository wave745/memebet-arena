"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { TopBar } from "@/components/top-bar"
import { WalletModal } from "@/components/wallet-modal"
import { useWallet } from "@/components/wallet-provider"
import { Button } from "@/components/ui/button"
import { PublicKey } from "@solana/web3.js"
import { fetchMarketByPdaFrontend } from "@/lib/market-frontend"
import * as anchor from "@coral-xyz/anchor"
import { LAMPORTS_PER_SOL } from "@solana/web3.js"
import { TrendingUp, TrendingDown, MessageSquare, Link, Reply, Copy, Check, BarChart3 } from "lucide-react"
import { Transaction } from "@solana/web3.js"
import { getPositionPda } from "@/lib/anchor/program"
import { buildPlaceBetInstruction, buildSellSharesInstruction, buildResolveMarketInstruction } from "@/lib/solana/instructions"
import { SolanaLogo } from "@/components/solana-logo"
import {
  loadComments,
  saveComment,
  createComment,
  formatCommentTime,
  formatCommentAddress,
  organizeComments,
  type Comment
} from "@/lib/comments"
import { formatMarketCapShort, formatMarketCap } from "@/lib/utils/format-market-cap"
import { getTokenData, type TokenData } from "@/lib/dexscreener"

interface ChainMarketData {
  marketPda: PublicKey
  tokenMint: PublicKey
  tokenSymbol: string
  tokenName: string
  tokenImage?: string
  targetMarketCap: anchor.BN
  endTimestamp: anchor.BN
  resolved: boolean
  yesPool: anchor.BN
  noPool: anchor.BN
  outcome: boolean | null
  creator?: PublicKey // Market creator (resolver)
}

export default function MarketPage() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()
  const { walletConnected, walletAddress, solBalance, connect, disconnect, connection, wallet } = useWallet()
  const [market, setMarket] = useState<ChainMarketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatches
  useEffect(() => {
    setMounted(true)
  }, [])
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)

  // Trading state
  const [tradeSide, setTradeSide] = useState<"YES" | "NO" | null>(null)
  const [tradeAction, setTradeAction] = useState<"buy" | "sell">("buy")
  const [tradeAmount, setTradeAmount] = useState("")
  const [tradeLoading, setTradeLoading] = useState(false)
  const [tradeError, setTradeError] = useState<string | null>(null)
  const [tradeSubmitted, setTradeSubmitted] = useState(false)
  const [txSignature, setTxSignature] = useState<string | null>(null)
  const [sellSide, setSellSide] = useState<"YES" | "NO" | null>(null) // Which position to sell
  const [userPosition, setUserPosition] = useState<{ amount: bigint; outcome: boolean } | null>(null)
  const [userYesPosition, setUserYesPosition] = useState<{ amount: bigint } | null>(null)
  const [userNoPosition, setUserNoPosition] = useState<{ amount: bigint } | null>(null)
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [finalMarketCap, setFinalMarketCap] = useState("")

  // Comments state
  const [comments, setComments] = useState<Comment[]>([])
  const [commentInput, setCommentInput] = useState("")
  const [commentLoading, setCommentLoading] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<string | null>(null) // Comment ID being replied to
  const [replyInputs, setReplyInputs] = useState<Map<string, string>>(new Map()) // Reply input for each comment
  const [showRulesMore, setShowRulesMore] = useState(false) // Rules expand/collapse
  const [previousYesPercent, setPreviousYesPercent] = useState<number | null>(null) // Track previous percentage for change indicator
  const [previousNoPercent, setPreviousNoPercent] = useState<number | null>(null) // Track previous NO percentage for change indicator
  const [copied, setCopied] = useState(false)
  const [chartType, setChartType] = useState<"dexscreener" | "market">("dexscreener") // Chart toggle state
  const [tokenData, setTokenData] = useState<TokenData | null>(null) // Token data from DexScreener


  // Fetch market from chain
  const fetchMarket = useCallback(async (isInitialLoad = false) => {
    if (!id || !connection) return

    try {
      // Only show loading state on initial load, not on polling updates
      if (isInitialLoad) {
        setLoading(true)
      }
      setError(null)

      const marketPda = new PublicKey(id)
      const marketData = await fetchMarketByPdaFrontend(connection, marketPda)

      if (!marketData) {
        if (isInitialLoad) {
          setError("Market not found")
        }
        return
      }

      setMarket({
        marketPda: marketData.marketPda,
        tokenMint: marketData.tokenMint,
        tokenSymbol: marketData.tokenSymbol,
        tokenName: marketData.tokenName,
        tokenImage: marketData.tokenImage,
        targetMarketCap: marketData.targetMarketCap,
        endTimestamp: marketData.endTimestamp,
        resolved: marketData.resolved,
        yesPool: marketData.yesPool,
        noPool: marketData.noPool,
        outcome: marketData.outcome,
        creator: marketData.creator,
      })
    } catch (err: any) {
      console.error("Failed to fetch market:", err)
      if (isInitialLoad) {
        setError(err.message || "Failed to load market")
      }
    } finally {
      if (isInitialLoad) {
        setLoading(false)
      }
    }
  }, [id, connection, wallet])

  // Fetch token data from DexScreener
  const fetchTokenData = useCallback(async () => {
    if (!market?.tokenMint) return

    try {
      const data = await getTokenData(market.tokenMint.toString())
      setTokenData(data)
    } catch (error) {
      console.warn('Failed to fetch token data:', error)
    }
  }, [market?.tokenMint])

  // Initial load
  useEffect(() => {
    fetchMarket(true)
  }, [fetchMarket])

  // Fetch token data when market loads
  useEffect(() => {
    if (market) {
      fetchTokenData()
    }
  }, [market, fetchTokenData])

  // Real-time polling every 10 seconds (reduced from 5 to reduce load)
  useEffect(() => {
    if (!connection || !id) return

    const interval = setInterval(() => {
      // Only fetch if tab is visible to save resources
      if (!document.hidden) {
        fetchMarket(false)
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [connection, id, fetchMarket])

  // Fetch user position (memoized to avoid unnecessary re-renders)
  const fetchUserPosition = useCallback(async () => {
    if (!market || !walletAddress || !connection) {
      setUserPosition(null)
      setUserYesPosition(null)
      setUserNoPosition(null)
      return
    }

    try {
      const userPubkey = new PublicKey(walletAddress)

      // Check both YES and NO positions
      const [yesPositionPda] = getPositionPda(market.marketPda, userPubkey, true)
      const [noPositionPda] = getPositionPda(market.marketPda, userPubkey, false)

      const yesPositionInfo = await connection.getAccountInfo(yesPositionPda)
      const noPositionInfo = await connection.getAccountInfo(noPositionPda)

      let yesAmount = 0n
      let noAmount = 0n

      if (yesPositionInfo && yesPositionInfo.data.length >= 82) {
        const data = yesPositionInfo.data
        // Read amount (offset 73, 8 bytes, little-endian)
        for (let i = 0; i < 8; i++) {
          yesAmount |= BigInt(data[73 + i]) << BigInt(i * 8)
        }
      }

      if (noPositionInfo && noPositionInfo.data.length >= 82) {
        const data = noPositionInfo.data
        // Read amount (offset 73, 8 bytes, little-endian)
        for (let i = 0; i < 8; i++) {
          noAmount |= BigInt(data[73 + i]) << BigInt(i * 8)
        }
      }

      // Set positions
      setUserYesPosition(yesAmount > 0n ? { amount: yesAmount } : null)
      setUserNoPosition(noAmount > 0n ? { amount: noAmount } : null)

      // For backward compatibility, set userPosition to the larger position (or YES if equal)
      if (yesAmount > 0n || noAmount > 0n) {
        if (yesAmount >= noAmount) {
          setUserPosition({ amount: yesAmount, outcome: true })
        } else {
          setUserPosition({ amount: noAmount, outcome: false })
        }
      } else {
        setUserPosition(null)
      }
    } catch (error) {
      console.error("Failed to fetch user position:", error)
      setUserPosition(null)
      setUserYesPosition(null)
      setUserNoPosition(null)
    }
  }, [market, walletAddress, connection])

  // Fetch user position when market or wallet changes
  useEffect(() => {
    fetchUserPosition()
  }, [market, walletAddress, connection, fetchUserPosition])

  // Real-time polling for user position every 5 seconds (reduced frequency)
  useEffect(() => {
    if (!market || !walletAddress || !connection) return

    const interval = setInterval(() => {
      fetchUserPosition()
    }, 5000) // Poll every 5 seconds (reduced from 3 to reduce load)

    return () => clearInterval(interval)
  }, [fetchUserPosition])

  // Auto-select sellSide when switching to sell tab or when positions are loaded
  useEffect(() => {
    if (tradeAction === "sell") {
      // If positions aren't loaded yet, fetch them
      if (market && walletAddress && connection && (!userYesPosition && !userNoPosition)) {
        fetchUserPosition()
      }

      const hasYes = userYesPosition && userYesPosition.amount > 0n
      const hasNo = userNoPosition && userNoPosition.amount > 0n

      // If user has only one position, auto-select it
      if (hasYes && !hasNo && sellSide !== "YES") {
        setSellSide("YES")
      } else if (hasNo && !hasYes && sellSide !== "NO") {
        setSellSide("NO")
      } else if (!hasYes && !hasNo) {
        setSellSide(null)
      } else if (hasYes && hasNo && !sellSide) {
        // If user has both but sellSide is not set, default to YES
        setSellSide("YES")
      }
    } else {
      // Reset sellSide when switching away from sell tab
      setSellSide(null)
    }
  }, [userYesPosition, userNoPosition, tradeAction, sellSide, market, walletAddress, connection, fetchUserPosition])

  const yesPoolSol = market ? Number(market.yesPool) / LAMPORTS_PER_SOL : 0
  const noPoolSol = market ? Number(market.noPool) / LAMPORTS_PER_SOL : 0
  const totalPool = yesPoolSol + noPoolSol

  const yesPercent = totalPool > 0 ? (yesPoolSol / totalPool) * 100 : 50
  const noPercent = totalPool > 0 ? (noPoolSol / totalPool) * 100 : 50

  // Track percentage changes - update baseline when market data changes significantly
  useEffect(() => {
    if (!market) return

    const currentYesPercent = totalPool > 0 ? (yesPoolSol / totalPool) * 100 : 50
    const currentNoPercent = totalPool > 0 ? (noPoolSol / totalPool) * 100 : 50

    if (previousYesPercent === null) {
      // Initialize on first load
      setPreviousYesPercent(currentYesPercent)
      setPreviousNoPercent(currentNoPercent)
      return
    }

    // Update baseline when change is significant (market data updated)
    // Use a small delay to allow the change indicator to be visible
    if (Math.abs(currentYesPercent - previousYesPercent) > 0.1 || Math.abs(currentNoPercent - (previousNoPercent || 0)) > 0.1) {
      const timer = setTimeout(() => {
        setPreviousYesPercent(currentYesPercent)
        setPreviousNoPercent(currentNoPercent)
      }, 3000) // Show change for 3 seconds before updating baseline

      // Cleanup function must be returned unconditionally
      return () => clearTimeout(timer)
    }
  }, [yesPoolSol, noPoolSol, totalPool, market, previousYesPercent, previousNoPercent]) // Track when pool values change

  const yesPercentChange = previousYesPercent !== null && market ? yesPercent - previousYesPercent : 0
  const noPercentChange = previousNoPercent !== null && market ? noPercent - previousNoPercent : 0
  const yesHasIncreased = yesPercentChange > 0.1
  const yesHasDecreased = yesPercentChange < -0.1
  const noHasIncreased = noPercentChange > 0.1
  const noHasDecreased = noPercentChange < -0.1



  const tokenDisplay = market ? (tokenData?.symbol || market.tokenSymbol) : "Loading..."

  const question = market
    ? `Will ${tokenDisplay} hit $${formatMarketCapShort(Number(market.targetMarketCap))}?`
    : "Loading..."

  const handleCopy = () => {
    if (market) {
      navigator.clipboard.writeText(market.tokenMint.toString())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const resolveDate = market ? new Date(Number(market.endTimestamp) * 1000) : new Date()

  const copyMarketLink = () => {
    if (typeof window !== "undefined") {
      const marketUrl = window.location.href
      navigator.clipboard.writeText(marketUrl)
      // Optional: You could add a toast notification here
    }
  }

  // Calculate potential "To Win" amount using LMSR formula (preview before bet)
  const calculatePayout = (side: "YES" | "NO", betAmount: number) => {
    if (betAmount <= 0 || totalPool === 0) return 0

    // LMSR Formula: toWin = betAmount * (totalPool / targetPool)
    const targetPool = side === "YES" ? yesPoolSol : noPoolSol

    // If target pool is 0, show infinite potential (market too thin)
    if (targetPool === 0) return Infinity

    const toWin = betAmount * (totalPool / targetPool)

    // Round to 4 decimal places for display
    return Number(toWin.toFixed(4))
  }

  const calculateSellRefund = (side: "YES" | "NO", sellAmount: number) => {
    if (sellAmount <= 0) return 0

    // Convert to lamports for precise calculation
    const sellAmountLamports = BigInt(Math.floor(sellAmount * LAMPORTS_PER_SOL))
    const yesPoolLamports = BigInt(Math.floor(yesPoolSol * LAMPORTS_PER_SOL))
    const noPoolLamports = BigInt(Math.floor(noPoolSol * LAMPORTS_PER_SOL))

    console.log(`💸 Calculating sell refund for ${side} position of ${sellAmount} SOL`)
    console.log(`   Pools: YES=${yesPoolSol.toFixed(4)} SOL, NO=${noPoolSol.toFixed(4)} SOL`)

    const yourPool = side === "YES" ? yesPoolLamports : noPoolLamports
    const otherPool = side === "YES" ? noPoolLamports : yesPoolLamports

    // If your pool is 0 (shouldn't happen for existing positions), return amount
    if (yourPool === 0n) {
      console.log(`   Your pool is empty - full refund`)
      return sellAmount
    }

    // Smart contract logic: share = sellAmount * otherPool / yourPool
    const share = (sellAmountLamports * otherPool) / yourPool
    const totalBeforeFee = sellAmountLamports + share

    // Apply 5% fee (95% of total)
    const refundAfterFee = (totalBeforeFee * 95n) / 100n

    // Subtract 10 SOL fee (10_000_000 lamports)
    const fee = 10_000_000n
    const finalRefund = refundAfterFee > fee ? refundAfterFee - fee : 0n

    // Convert back to SOL
    const refundSol = Number(finalRefund) / LAMPORTS_PER_SOL

    console.log(`   Calculation: yourPool=${yourPool.toString()}, otherPool=${otherPool.toString()}`)
    console.log(`   share=${share.toString()}, totalBeforeFee=${totalBeforeFee.toString()}`)
    console.log(`   refundAfterFee=${refundAfterFee.toString()}, finalRefund=${finalRefund.toString()}`)
    console.log(`   Final refund: ${refundSol.toFixed(6)} SOL`)

    return refundSol
  }

  const handleAmountQuickAdd = (add: number) => {
    const current = parseFloat(tradeAmount) || 0
    let newAmount = current + add

    // If selling, cap at position balance
    if (tradeAction === "sell" && sellSide) {
      const selectedPosition = sellSide === "YES" ? userYesPosition : userNoPosition
      if (selectedPosition) {
        const positionAmountSol = Number(selectedPosition.amount) / LAMPORTS_PER_SOL
        newAmount = Math.min(newAmount, positionAmountSol)
      }
    } else if (tradeAction === "buy") {
      // If buying, cap at wallet balance (leave 0.01 SOL for fees/rent)
      const maxSol = Math.max(0, solBalance - 0.01)
      newAmount = Math.min(newAmount, maxSol)
    }

    setTradeAmount(Math.max(0, newAmount).toFixed(2))
  }

  const handleMaxAmount = () => {
    if (tradeAction === "sell") {
      // For selling, use selected position balance
      const selectedPosition = sellSide === "YES" ? userYesPosition : userNoPosition
      if (selectedPosition) {
        const positionAmountSol = Number(selectedPosition.amount) / LAMPORTS_PER_SOL
        setTradeAmount(positionAmountSol.toFixed(4))
      }
    } else if (tradeAction === "buy" && walletAddress && connection) {
      // For buying, use wallet balance (leave 0.01 SOL for fees/rent)
      const maxSol = Math.max(0, solBalance - 0.01)
      setTradeAmount(maxSol.toFixed(2))
    }
  }

  const handleTrade = async () => {
    if (!walletConnected || !walletAddress || !connection || !wallet || !market) {
      setTradeError("Connect your wallet")
      return
    }

    if (tradeAction === "buy") {
      if (!tradeSide) {
        setTradeError("Select YES or NO")
        return
      }

      const betAmount = parseFloat(tradeAmount)
      if (!tradeAmount || betAmount <= 0 || isNaN(betAmount)) {
        setTradeError("Enter a valid amount")
        return
      }

      if (market.resolved) {
        setTradeError("Market is already resolved")
        return
      }

      setTradeLoading(true)
      setTradeSubmitted(true)
      setTradeError(null)

      try {
        const userPubkey = new PublicKey(walletAddress)
        const marketPda = market.marketPda
        const outcome = tradeSide === "YES"
        const [positionPda] = getPositionPda(marketPda, userPubkey, outcome)

        // Check if position exists for this outcome
        const positionInfo = await connection.getAccountInfo(positionPda)
        const isNewPosition = !positionInfo

        // Check balance first
        const balance = await connection.getBalance(userPubkey)
        const amountLamports = BigInt(Math.floor(betAmount * LAMPORTS_PER_SOL))
        const positionAccountRent = isNewPosition ? 1000000 : 0 // Only need rent for new positions
        const estimatedFee = 5000
        const totalRequired = amountLamports + BigInt(positionAccountRent) + BigInt(estimatedFee)

        if (BigInt(balance) < totalRequired) {
          const requiredSol = Number(totalRequired) / LAMPORTS_PER_SOL
          const currentSol = balance / LAMPORTS_PER_SOL
          throw new Error(
            `Insufficient balance. You need ${requiredSol.toFixed(4)} SOL ` +
            `(bet: ${betAmount} SOL${isNewPosition ? " + rent: ~0.001 SOL" : ""} + fees), but you have ${currentSol.toFixed(4)} SOL.`
          )
        }

        const instruction = buildPlaceBetInstruction(
          marketPda,
          positionPda,
          userPubkey,
          outcome,
          amountLamports,
          market.tokenMint,
          market.targetMarketCap,
          market.endTimestamp
        )

        const transaction = new Transaction().add(instruction)
        transaction.feePayer = userPubkey

        // Get blockhash before signing (required for signing)
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed")
        transaction.recentBlockhash = blockhash

        // Sign transaction (user approval can take time)
        const signedTransaction = await wallet.signTransaction(transaction)

        // Send transaction immediately (don't modify signed transaction - it invalidates signature)
        // Blockhash is valid for ~60 seconds, which should be enough
        const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        })

        setTxSignature(signature)

        // Wait for confirmation
        await connection.confirmTransaction(signature, "confirmed")

        // Immediate refresh of market data and position
        await Promise.all([
          fetchMarket(false),
          fetchUserPosition()
        ])

        // Notify Activity Backend
        console.log('📤 Sending activity to backend:', {
          txHash: signature,
          type: tradeSide === 'YES' ? 'BET_YES' : 'BET_NO',
          marketPda: market.marketPda.toString(),
          user: walletAddress,
          amount: amountLamports.toString()
        })
        fetch('/api/activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txHash: signature,
            type: tradeSide === 'YES' ? 'BET_YES' : 'BET_NO',
            marketPda: market.marketPda.toString(),
            user: walletAddress,
            amount: amountLamports.toString(),
            marketInfo: {
              tokenMint: market.tokenMint.toString(),
              ticker: market.tokenSymbol,
              targetCap: market.targetMarketCap.toString(),
              endTimestamp: Number(market.endTimestamp),
              resolved: market.resolved
            }
          })
        }).then(response => {
          console.log('📥 Activity API response:', response.status, response.statusText)
          return response.json()
        }).then(data => {
          console.log('✅ Activity created:', data)
        }).catch(error => {
          console.error('❌ Activity creation failed:', error)
        })

        // Reset form
        setTradeAmount("")
        setTradeSide(null)
        setTradeSubmitted(false)
        setTradeLoading(false)
      } catch (error: any) {
        console.error("Trade error:", error)
        let errorMsg = "Transaction failed"

        // Check error message
        const errorMessage = error.message || ""
        // Check logs for error details
        const logs = error.logs || []
        const logString = logs.join("\n")

        if (errorMessage.includes("User rejected") || errorMessage.includes("User cancelled")) {
          setTradeError(null)
          setTradeSubmitted(false)
          setTradeLoading(false)
          return
        } else if (errorMessage.includes("MarketResolved") || logString.includes("MarketResolved")) {
          errorMsg = "Market is already resolved"
        } else if (errorMessage.includes("MarketExpired") || logString.includes("MarketExpired")) {
          errorMsg = "Market has expired"
        } else if (errorMessage.includes("InvalidBetAmount") || logString.includes("InvalidBetAmount")) {
          errorMsg = "Invalid bet amount"
        } else if (errorMessage.includes("PositionOutcomeMismatch") || logString.includes("PositionOutcomeMismatch") || logString.includes("Cannot bet on different outcome")) {
          errorMsg = "You already have a position on the opposite side. Sell your current position first to switch sides."
        } else if (errorMessage) {
          errorMsg = errorMessage.slice(0, 150)
        }

        setTradeError(errorMsg)
        setTradeSubmitted(false)
      } finally {
        setTradeLoading(false)
      }
    } else {
      // SELL
      if (!sellSide) {
        setTradeError("Select which position to sell (YES or NO)")
        return
      }

      const selectedPosition = sellSide === "YES" ? userYesPosition : userNoPosition
      if (!selectedPosition || selectedPosition.amount === 0n) {
        setTradeError(`You don't have a ${sellSide} position on this market`)
        return
      }

      const sellAmount = parseFloat(tradeAmount)
      if (!tradeAmount || sellAmount <= 0 || isNaN(sellAmount)) {
        setTradeError("Enter a valid amount")
        return
      }

      const sellAmountLamports = BigInt(Math.floor(sellAmount * LAMPORTS_PER_SOL))
      const positionAmountSol = Number(selectedPosition.amount) / LAMPORTS_PER_SOL

      if (sellAmount > positionAmountSol) {
        setTradeError(`You can only sell up to ${positionAmountSol.toFixed(4)} SOL`)
        return
      }

      if (market.resolved) {
        setTradeError("Market is already resolved. Use Claim instead.")
        return
      }

      setTradeLoading(true)
      setTradeSubmitted(true)
      setTradeError(null)

      try {
        const userPubkey = new PublicKey(walletAddress)
        const marketPda = market.marketPda

        if (!sellSide) {
          throw new Error("No position side selected")
        }

        const outcome = sellSide === "YES"
        const [positionPda] = getPositionPda(marketPda, userPubkey, outcome)

        const instruction = buildSellSharesInstruction(
          marketPda,
          positionPda,
          userPubkey,
          outcome,
          sellAmountLamports
        )

        const transaction = new Transaction().add(instruction)
        transaction.feePayer = userPubkey

        // Get blockhash before signing (required for signing)
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed")
        transaction.recentBlockhash = blockhash

        // Sign transaction (user approval can take time)
        const signedTransaction = await wallet.signTransaction(transaction)

        // Send transaction immediately (don't modify signed transaction - it invalidates signature)
        // Blockhash is valid for ~60 seconds, which should be enough
        const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        })

        setTxSignature(signature)

        // Wait for confirmation
        await connection.confirmTransaction(signature, "confirmed")

        // Immediate refresh of market data and position
        await Promise.all([
          fetchMarket(false),
          fetchUserPosition()
        ])

        // Notify Activity Backend
        fetch('/api/activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txHash: signature,
            type: 'SELL',
            marketPda: market.marketPda.toString(),
            user: walletAddress,
            amount: sellAmountLamports.toString(),
            marketInfo: {
              tokenMint: market.tokenMint.toString(),
              ticker: market.tokenSymbol,
              targetCap: market.targetMarketCap.toString(),
              endTimestamp: Number(market.endTimestamp),
              resolved: market.resolved
            }
          })
        }).catch(console.error)

        // Reset form
        setTradeAmount("")
        setTradeSubmitted(false)
        setTradeLoading(false)
      } catch (error: any) {
        console.error("Sell error:", error)
        let errorMsg = "Transaction failed"
        if (error.message) {
          if (error.message.includes("User rejected")) {
            setTradeError(null)
            setTradeSubmitted(false)
            setTradeLoading(false)
            return
          } else if (error.message.includes("MarketResolved")) {
            errorMsg = "Market is already resolved"
          } else if (error.message.includes("InvalidBetAmount")) {
            errorMsg = "Invalid sell amount"
          } else {
            errorMsg = error.message.slice(0, 100)
          }
        }
        setTradeError(errorMsg)
        setTradeSubmitted(false)
      } finally {
        setTradeLoading(false)
      }
    }
  }

  const betAmount = parseFloat(tradeAmount) || 0
  const potentialPayout = (tradeAction === "buy" && tradeSide) ? calculatePayout(tradeSide, betAmount) : 0
  const potentialRefund = (tradeAction === "sell" && sellSide) ? calculateSellRefund(sellSide, betAmount) : 0



  // Handle market resolution
  const handleResolveMarket = async () => {
    if (!walletConnected || !walletAddress || !connection || !wallet || !market) {
      setResolveError("Connect your wallet")
      return
    }

    const marketCapValue = parseFloat(finalMarketCap)
    if (!finalMarketCap || marketCapValue <= 0 || isNaN(marketCapValue)) {
      setResolveError("Enter a valid final market cap")
      return
    }

    if (market.resolved) {
      setResolveError("Market is already resolved")
      return
    }

    // Check if market has expired
    const now = Math.floor(Date.now() / 1000)
    if (now < Number(market.endTimestamp)) {
      setResolveError("Market has not expired yet")
      return
    }

    setResolving(true)
    setResolveError(null)

    try {
      const userPubkey = new PublicKey(walletAddress)
      const marketPda = market.marketPda

      // Convert market cap to base units (raw dollar value)
      const finalMarketCapLamports = BigInt(Math.floor(marketCapValue))

      const instruction = buildResolveMarketInstruction(
        marketPda,
        userPubkey,
        finalMarketCapLamports
      )

      const transaction = new Transaction().add(instruction)
      transaction.feePayer = userPubkey

      // Get blockhash before signing (required for signing)
      const { blockhash } = await connection.getLatestBlockhash("confirmed")
      transaction.recentBlockhash = blockhash

      // Sign transaction
      const signedTransaction = await wallet.signTransaction(transaction)

      // Send transaction immediately
      const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      })

      // Wait for confirmation
      await connection.confirmTransaction(signature, "confirmed")

      // Immediate refresh of market data and position
      await Promise.all([
        fetchMarket(false),
        fetchUserPosition()
      ])

      // Notify Activity Backend
      fetch('/api/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash: signature,
          type: 'RESOLVE',
          marketPda: market.marketPda.toString(),
          user: walletAddress,
          amount: "0",
          marketInfo: {
            tokenMint: market.tokenMint.toString(),
            ticker: market.tokenSymbol,
            targetCap: market.targetMarketCap.toString(),
            endTimestamp: Number(market.endTimestamp),
            resolved: true,
            outcome: marketCapValue >= Number(market.targetMarketCap)
          }
        })
      }).catch(console.error)

      // Reset form
      setFinalMarketCap("")
      setResolving(false)
    } catch (error: any) {
      console.error("Resolve error:", error)
      let errorMsg = "Transaction failed"
      const errorMessage = error.message || ""
      const logs = error.logs || []
      const logString = logs.join("\n")

      if (errorMessage.includes("User rejected") || errorMessage.includes("User cancelled")) {
        setResolveError(null)
        setResolving(false)
        return
      } else if (errorMessage.includes("MarketResolved") || logString.includes("MarketResolved") || logString.includes("AlreadyResolved")) {
        errorMsg = "Market is already resolved"
      } else if (errorMessage.includes("MarketNotExpired") || logString.includes("MarketNotExpired")) {
        errorMsg = "Market has not expired yet"
      } else if (errorMessage) {
        errorMsg = errorMessage.slice(0, 150)
      }

      setResolveError(errorMsg)
      setResolving(false)
    }
  }


  // Load comments for this market
  const loadCommentsForMarket = useCallback(async () => {
    if (!market) return
    try {
      const marketPdaStr = market.marketPda.toString()
      const loaded = await loadComments(marketPdaStr)
      setComments(loaded)
    } catch (error) {
      console.error("Failed to load comments:", error)
    }
  }, [market])

  // Post a comment
  const handlePostComment = async () => {
    if (!walletConnected || !walletAddress || !market) {
      setCommentError("Connect your wallet to comment")
      return
    }

    if (!commentInput.trim()) {
      setCommentError("Comment cannot be empty")
      return
    }

    setCommentLoading(true)
    setCommentError(null)

    try {
      const marketPdaStr = market.marketPda.toString()
      const isHolder = Boolean((userYesPosition?.amount && userYesPosition.amount > 0n) || (userNoPosition?.amount && userNoPosition.amount > 0n))

      // Save comment via API
      await saveComment({
        id: '', // Will be generated by API
        marketPda: marketPdaStr,
        author: walletAddress,
        content: commentInput.trim(),
        timestamp: Date.now(),
        isHolder
      } as Comment)

      // Reload comments
      await loadCommentsForMarket()

      // Clear input
      setCommentInput("")
    } catch (error: any) {
      setCommentError(error.message || "Failed to post comment")
    } finally {
      setCommentLoading(false)
    }
  }

  // Post a reply to a comment
  const handlePostReply = async (parentId: string) => {
    if (!walletConnected || !walletAddress || !market) {
      setCommentError("Connect your wallet to reply")
      return
    }

    const replyText = replyInputs.get(parentId) || ""
    if (!replyText.trim()) {
      setCommentError("Reply cannot be empty")
      return
    }

    setCommentLoading(true)
    setCommentError(null)

    try {
      const marketPdaStr = market.marketPda.toString()
      const isHolder = Boolean((userYesPosition?.amount && userYesPosition.amount > 0n) || (userNoPosition?.amount && userNoPosition.amount > 0n))

      // Save reply via API
      await saveComment({
        id: '', // Will be generated by API
        marketPda: marketPdaStr,
        author: walletAddress,
        content: replyText.trim(),
        timestamp: Date.now(),
        parentId,
        isHolder
      } as Comment)

      // Reload comments
      await loadCommentsForMarket()

      // Clear reply input
      const newReplyInputs = new Map(replyInputs)
      newReplyInputs.delete(parentId)
      setReplyInputs(newReplyInputs)
      setReplyingTo(null)
    } catch (error: any) {
      setCommentError(error.message || "Failed to post reply")
    } finally {
      setCommentLoading(false)
    }
  }

  // Get stable market PDA string for dependencies
  const marketPdaStr = market?.marketPda.toString() ?? null

  // Load comments when market loads (initial load)
  useEffect(() => {
    if (marketPdaStr) {
      loadCommentsForMarket()
    }
  }, [marketPdaStr, loadCommentsForMarket])

  // Poll comments every 10 seconds (reduced frequency to avoid overwriting)
  useEffect(() => {
    if (!marketPdaStr) return

    const interval = setInterval(async () => {
      try {
        await loadCommentsForMarket()
      } catch (error) {
        console.error("Failed to poll comments:", error)
      }
    }, 10000) // Poll every 10 seconds (reduced from 5)

    return () => clearInterval(interval)
  }, [marketPdaStr, loadCommentsForMarket])

  // Check if user is admin
  const ADMIN_PUBKEY = "3zAjK7AzN7Wdor2i3kzcNrdRJc8PzysspjbgG8awp5NB"
  const isAdmin = walletAddress?.toLowerCase() === ADMIN_PUBKEY.toLowerCase()

  // Prevent hydration mismatches by not rendering until mounted
  if (!mounted) {
    return (
      <main className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="text-6xl animate-pulse">👾</div>
        <p className="text-muted-foreground">Loading market...</p>
      </main>
    )
  }

  return (
    <>
      <TopBar
        walletConnected={walletConnected}
        walletAddress={walletAddress}
        solBalance={solBalance}
        onConnect={connect}
        onDisconnect={disconnect}
        onWalletClick={() => setIsWalletModalOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        onSearchModalOpen={() => router.push("/")}
      />
      {loading ? (
        <main className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="text-6xl animate-pulse">👾</div>
          <p className="text-muted-foreground">Loading market from chain...</p>
        </main>
      ) : error ? (
        <main className="flex items-center justify-center py-16">
          <div className="text-center space-y-2">
            <p className="text-red-500">{error}</p>
            <Button onClick={() => fetchMarket(true)} variant="outline">Retry</Button>
          </div>
        </main>
      ) : !market ? (
        <main className="flex items-center justify-center py-16">
          <p className="text-muted-foreground">Market not found</p>
        </main>
      ) : (
        <main className="relative sm:fixed sm:inset-0 pt-[110px] sm:pt-0 sm:top-[138px] min-h-screen sm:overflow-hidden">
          <div className="mx-auto max-w-7xl px-3 sm:px-4 sm:h-full py-4 sm:py-0">
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-3 sm:h-full">
              {/* Left: Chart and Details */}
              <div className="lg:col-span-2 flex flex-col sm:h-full sm:overflow-hidden">
                {/* Fixed Question Header - Does not scroll, spans only left column */}
                <div className="flex-shrink-0 z-30 glass-header border-b border-white/10 py-3 mb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3 mb-1">
                        {/* Token Icon */}
                        <div className="relative w-8 h-8 rounded-full overflow-hidden bg-[#0B0B0D] border border-cyan-400/30 flex-shrink-0 mt-0.5">
                          <img
                            key={tokenData?.image || 'fallback'}
                            src={tokenData?.image || `https://api.dicebear.com/7.x/identicon/svg?seed=${market.tokenMint}`}
                            alt="Token"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback to DiceBear if DexScreener image fails
                              const target = e.target as HTMLImageElement
                              if (target.src !== `https://api.dicebear.com/7.x/identicon/svg?seed=${market.tokenMint}`) {
                                target.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${market.tokenMint}`
                              }
                            }}
                          />
                        </div>
                        <div className="flex-1">
                          <h1 className="text-base sm:text-lg font-bold text-[#E5E5E5] flex-1 leading-tight inline neon-text-green">
                            {question}
                          </h1>
                          <button
                            onClick={handleCopy}
                            className="inline-flex ml-2 p-0.5 text-[#8A8A8A] hover:text-[#E5E5E5] transition-colors align-middle"
                            title="Copy token address"
                          >
                            {copied ? <Check className="h-3 w-3 neon-text-green" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        {market.resolved ? (
                          <div className={`text-xs font-semibold px-2 py-1 rounded ${market.outcome
                            ? "bg-[#6B9E78]/20 text-[#6B9E78] border border-[#6B9E78]/30"
                            : "bg-[#A67C7C]/20 text-[#A67C7C] border border-[#A67C7C]/30"
                            }`}>
                            {market.outcome ? "✅ YES" : "❌ NO"}
                          </div>
                        ) : (
                          <>
                            <div className="text-xs text-[#8A8A8A] font-mono">
                              Resolves {resolveDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                              {/* YES Percentage */}
                              <div className="flex items-center gap-1.5 text-xs">
                                <span className="neon-text-green font-black text-[14px] transform-gpu">YES {yesPercent.toFixed(1)}%</span>
                                {yesHasIncreased && (
                                  <div className="flex items-center gap-0.5 neon-text-green animate-pulse">
                                    <TrendingUp className="h-4 w-4" />
                                    <span className="text-[11px] font-bold">{Math.abs(yesPercentChange).toFixed(1)}%</span>
                                  </div>
                                )}
                                {yesHasDecreased && (
                                  <div className="flex items-center gap-0.5 neon-text-magenta animate-pulse">
                                    <TrendingDown className="h-4 w-4" />
                                    <span className="text-[11px] font-bold">{Math.abs(yesPercentChange).toFixed(1)}%</span>
                                  </div>
                                )}
                              </div>
                              {/* NO Percentage */}
                              <div className="flex items-center gap-1.5 text-xs">
                                <span className="text-[#A67C7C] font-semibold transform-gpu">NO {noPercent.toFixed(1)}%</span>
                                {noHasIncreased && (
                                  <div className="flex items-center gap-0.5 text-[#A67C7C] animate-pulse">
                                    <TrendingUp className="h-3 w-3" />
                                    <span className="text-[10px]">{Math.abs(noPercentChange).toFixed(1)}%</span>
                                  </div>
                                )}
                                {noHasDecreased && (
                                  <div className="flex items-center gap-0.5 text-[#6B9E78] animate-pulse">
                                    <TrendingDown className="h-3 w-3" />
                                    <span className="text-[10px]">{Math.abs(noPercentChange).toFixed(1)}%</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      <button
                        onClick={() => setChartType(chartType === "dexscreener" ? "market" : "dexscreener")}
                        className={`transition-colors p-1.5 ${chartType === "dexscreener"
                            ? "text-[#69ff94] hover:text-[#69ff94]/80"
                            : "text-[#8A8A8A] hover:text-[#E5E5E5]"
                          }`}
                        title={`Switch to ${chartType === "dexscreener" ? "Market" : "DexScreener"} chart`}
                      >
                        <BarChart3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={copyMarketLink}
                        className="text-[#8A8A8A] hover:text-[#E5E5E5] transition-colors p-1.5"
                        title="Copy market link"
                      >
                        <Link className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Scrollable Content Area */}
                <div className="flex-1 sm:overflow-y-auto space-y-4 sm:space-y-6 pb-4 sm:pb-6 scrollbar-hide">
                  {/* Resolution UI - Show if market expired and not resolved, or if resolved show outcome */}
                  {isAdmin && !market.resolved && Math.floor(Date.now() / 1000) >= Number(market.endTimestamp) && (
                    <div className="border border-amber-500/30 bg-amber-500/10 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-amber-500 mb-3">Resolve Market</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-[#8A8A8A] mb-1 block">Final Market Cap (USD)</label>
                          <input
                            type="number"
                            step="1"
                            value={finalMarketCap}
                            onChange={(e) => setFinalMarketCap(e.target.value)}
                            placeholder="e.g., 1000000"
                            className="w-full glass-input rounded px-3 py-2 text-sm text-[#E5E5E5] placeholder:text-[#8A8A8A]"
                            disabled={resolving}
                          />
                          <p className="text-xs text-[#8A8A8A] mt-1">
                            Target: {formatMarketCap(Number(market.targetMarketCap))}
                          </p>
                        </div>
                        {resolveError && (
                          <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/30 rounded px-2 py-1.5">
                            {resolveError}
                          </div>
                        )}
                        <Button
                          onClick={handleResolveMarket}
                          disabled={resolving || !finalMarketCap}
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                        >
                          {resolving ? "Resolving..." : "Resolve Market"}
                        </Button>
                      </div>
                    </div>
                  )}


                  {/* Chart Section */}
                  <div className="glass p-2 sm:p-4">
                    {market ? (
                      <div className="rounded-xl overflow-hidden border border-white/10">
                        {chartType === "dexscreener" ? (
                          <iframe
                            src={`https://dexscreener.com/solana/${market.tokenMint.toString()}?embed=1&theme=dark&trades=0&info=0`}
                            className="w-full h-[240px] sm:h-[320px] border-0 transform-gpu"
                            title="DexScreener Chart"
                            allowFullScreen
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-[240px] sm:h-[320px] flex items-center justify-center bg-[#0B0B0D] rounded border border-border/20">
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <div className="text-4xl animate-pulse">👾</div>
                              <p className="text-muted-foreground text-xs sm:text-sm">Loading chart...</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-[240px] sm:h-[320px] flex items-center justify-center bg-[#0B0B0D] rounded border border-border/20">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <div className="text-4xl animate-pulse">👾</div>
                          <p className="text-muted-foreground text-xs sm:text-sm">Loading chart...</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Rules Section - Matching Polymarket Style */}
                  {market && (
                    <div className="glass p-3 sm:p-4">
                      <h3 className="text-base sm:text-lg font-semibold text-[#E5E5E5] mb-2 sm:mb-3">Rules</h3>

                      {/* Generate default rules based on market data */}
                      {(() => {
                        const tokenAddress = market.tokenMint.toString()
                        const targetCap = formatMarketCapShort(Number(market.targetMarketCap))
                        const resolveTime = new Date(Number(market.endTimestamp) * 1000).toLocaleString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          timeZoneName: "short"
                        })

                        const defaultRules = `This market will resolve to "Yes" if the token at address ${tokenAddress.slice(0, 8)}...${tokenAddress.slice(-8)} reaches or exceeds $${targetCap} market cap at any point before ${resolveTime}.

Market cap will be determined by the highest reliable source available (CoinGecko, CoinMarketCap, Birdeye, DexScreener) at the exact resolution time.

If the token is delisted, rugged, or data becomes unreliable, the market creator will determine fair resolution based on last known valid data.

Resolution time is final — no appeals. The market will automatically resolve based on the target market cap threshold.`

                        const shortRules = defaultRules.split('\n\n')[0]
                        const fullRules = defaultRules

                        // Helper to shorten address
                        const shortenAddress = (addr: string | PublicKey | undefined) => {
                          if (!addr) return "N/A"
                          const addrStr = typeof addr === "string" ? addr : addr.toString()
                          return `${addrStr.slice(0, 6)}...${addrStr.slice(-6)}`
                        }

                        // Use the actual creator from chain data (resolver)
                        const resolverAddress = market.creator || market.marketPda

                        return (
                          <>
                            <p className="text-[#E5E5E5] text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                              {showRulesMore ? fullRules : shortRules}
                            </p>

                            {/* Resolver Badge - Only shown when expanded */}
                            {showRulesMore && resolverAddress && (
                              <div className="mt-4 pt-4 border-t border-border/20">
                                <div className="flex items-center gap-3">
                                  <span className="text-red-500 font-semibold text-sm">Resolver</span>
                                  <a
                                    href={`https://solscan.io/account/${resolverAddress.toString()}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#3BA4FF] font-mono text-sm hover:text-[#5BB5FF] transition-colors"
                                  >
                                    {shortenAddress(resolverAddress)}
                                  </a>
                                </div>
                              </div>
                            )}

                            <button
                              onClick={() => setShowRulesMore(!showRulesMore)}
                              className="neon-text-cyan text-sm mt-3 flex items-center gap-1 hover:brightness-125 transition-all"
                            >
                              {showRulesMore ? "Show less" : "Show more"}
                              <span className="text-xs">{showRulesMore ? "▲" : "▼"}</span>
                            </button>
                          </>
                        )
                      })()}
                    </div>
                  )}

                  {/* Comments Section */}
                  <div className="glass p-3 sm:p-4">
                    <div className="mb-3 sm:mb-4">
                      <h2 className="text-xs sm:text-sm font-semibold text-[#E5E5E5] flex items-center gap-2 mb-1">
                        <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4" />
                        Comments
                        <span className="text-[10px] sm:text-xs text-[#8A8A8A] font-normal">({comments.length})</span>
                      </h2>
                      <p className="text-[10px] sm:text-xs text-[#8A8A8A]">Public comments — visible to everyone</p>
                    </div>

                    {/* Comment Input */}
                    {walletConnected ? (
                      <div className="mb-4">
                        <textarea
                          value={commentInput}
                          onChange={(e) => {
                            setCommentInput(e.target.value)
                            setCommentError(null)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                              handlePostComment()
                            }
                          }}
                          placeholder="Add a comment..."
                          className="w-full glass-input rounded px-2 sm:px-3 py-2 text-xs sm:text-sm text-[#E5E5E5] placeholder:text-[#8A8A8A] resize-none focus:outline-none"
                          rows={3}
                          maxLength={500}
                          disabled={commentLoading}
                        />
                        {commentError && (
                          <div className="mt-2">
                            <span className="text-xs text-red-500">{commentError}</span>
                          </div>
                        )}
                        <Button
                          onClick={handlePostComment}
                          disabled={commentLoading || !commentInput.trim()}
                          className="mt-2 w-full bg-[#6B9E78] hover:bg-[#6B9E78]/90 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {commentLoading ? "Posting..." : "Post"}
                        </Button>
                      </div>
                    ) : (
                      <div className="mb-4 p-3 glass text-center">
                        <p className="text-xs text-[#8A8A8A] mb-2">Connect your wallet to comment</p>
                        <Button
                          onClick={connect}
                          className="w-full bg-[#6B9E78] hover:bg-[#6B9E78]/90 text-white text-sm"
                        >
                          Connect Wallet
                        </Button>
                      </div>
                    )}

                    {/* Comments List */}
                    <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-hide">
                      {comments.length === 0 ? (
                        <div className="text-center py-8 text-[#8A8A8A] text-sm">
                          No comments yet. Be the first to comment!
                        </div>
                      ) : (() => {
                        const { topLevel, replies } = organizeComments(comments)
                        return topLevel.map((comment) => {
                          const commentReplies = replies.get(comment.id) || []
                          const isReplying = replyingTo === comment.id
                          const replyText = replyInputs.get(comment.id) || ""

                          return (
                            <div
                              key={comment.id}
                              className="glass rounded-lg p-3 transition-all hover:translate-y-[-2px] transform-gpu will-change-transform"
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="h-6 w-6 rounded-full bg-[#6B9E78]/20 flex items-center justify-center flex-shrink-0">
                                    <span className="text-xs font-semibold text-[#6B9E78]">
                                      {formatCommentAddress(comment.author).slice(0, 2).toUpperCase()}
                                    </span>
                                  </div>
                                  <span className="text-xs font-mono text-[#8A8A8A] truncate">
                                    {formatCommentAddress(comment.author)}
                                  </span>
                                  {comment.isHolder && (
                                    <span className="text-[10px] bg-[#6B9E78]/20 text-[#6B9E78] px-1.5 py-0.5 rounded border border-[#6B9E78]/30">
                                      Holder
                                    </span>
                                  )}
                                  {comment.author === walletAddress && (
                                    <span className="text-xs text-[#6B9E78] font-medium">(You)</span>
                                  )}
                                </div>
                                <span className="text-xs text-[#8A8A8A] flex-shrink-0">
                                  {formatCommentTime(comment.timestamp)}
                                </span>
                              </div>
                              <p className="text-sm text-[#E5E5E5] whitespace-pre-wrap break-words mb-2">
                                {comment.content}
                              </p>

                              {/* Reply Button */}
                              {walletConnected && (
                                <button
                                  onClick={() => {
                                    setReplyingTo(isReplying ? null : comment.id)
                                    if (!isReplying) {
                                      const newReplyInputs = new Map(replyInputs)
                                      newReplyInputs.set(comment.id, "")
                                      setReplyInputs(newReplyInputs)
                                    }
                                  }}
                                  className="flex items-center gap-1 text-xs text-[#8A8A8A] hover:text-[#6B9E78] transition-colors"
                                >
                                  <Reply className="h-3 w-3" />
                                  {isReplying ? "Cancel" : "Reply"}
                                </button>
                              )}

                              {/* Reply Input */}
                              {isReplying && walletConnected && (
                                <div className="mt-3 pt-3 border-t border-border/20">
                                  <textarea
                                    value={replyText}
                                    onChange={(e) => {
                                      const newReplyInputs = new Map(replyInputs)
                                      newReplyInputs.set(comment.id, e.target.value)
                                      setReplyInputs(newReplyInputs)
                                      setCommentError(null)
                                    }}
                                    placeholder="Write a reply..."
                                    className="w-full glass-input rounded px-3 py-2 text-xs text-[#E5E5E5] placeholder:text-[#8A8A8A] resize-none focus:outline-none"
                                    rows={2}
                                    maxLength={500}
                                    disabled={commentLoading}
                                  />
                                  <div className="flex items-center justify-between mt-2">
                                    <span className="text-xs text-[#8A8A8A]">
                                      {replyText.length}/500
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        onClick={() => {
                                          setReplyingTo(null)
                                          const newReplyInputs = new Map(replyInputs)
                                          newReplyInputs.delete(comment.id)
                                          setReplyInputs(newReplyInputs)
                                        }}
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs h-7 px-2 text-[#8A8A8A] hover:text-[#E5E5E5]"
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        onClick={() => handlePostReply(comment.id)}
                                        disabled={commentLoading || !replyText.trim()}
                                        size="sm"
                                        className="text-xs h-7 px-3 bg-[#6B9E78] hover:bg-[#6B9E78]/90 text-white disabled:opacity-50"
                                      >
                                        {commentLoading ? "Posting..." : "Reply"}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Nested Replies */}
                              {commentReplies.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-border/10 space-y-2">
                                  {commentReplies.map((reply) => (
                                    <div
                                      key={reply.id}
                                      className="glass rounded p-2 ml-4 opacity-80"
                                    >
                                      <div className="flex items-start justify-between gap-2 mb-1">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <div className="h-5 w-5 rounded-full bg-[#6B9E78]/15 flex items-center justify-center flex-shrink-0">
                                            <span className="text-[10px] font-semibold text-[#6B9E78]">
                                              {formatCommentAddress(reply.author).slice(0, 2).toUpperCase()}
                                            </span>
                                          </div>
                                          <span className="text-[10px] font-mono text-[#8A8A8A] truncate">
                                            {formatCommentAddress(reply.author)}
                                          </span>
                                          {reply.isHolder && (
                                            <span className="text-[8px] bg-[#6B9E78]/20 text-[#6B9E78] px-1.5 py-0.5 rounded border border-[#6B9E78]/30">
                                              Holder
                                            </span>
                                          )}
                                          {reply.author === walletAddress && (
                                            <span className="text-[10px] text-[#6B9E78] font-medium">(You)</span>
                                          )}
                                        </div>
                                        <span className="text-[10px] text-[#8A8A8A] flex-shrink-0">
                                          {formatCommentTime(reply.timestamp)}
                                        </span>
                                      </div>
                                      <p className="text-xs text-[#E5E5E5] whitespace-pre-wrap break-words">
                                        {reply.content}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Fixed Trade Panel */}
              <div className="lg:col-span-1">
                <div className="sm:sticky sm:top-0 glass-panel p-3 sm:p-4">
                  {/* Buy/Sell Tabs and Market Dropdown */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/20">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => {
                          setTradeAction("buy")
                          setTradeSide(null)
                          setTradeAmount("")
                        }}
                        className={`text-xs sm:text-sm font-medium transition-colors relative ${tradeAction === "buy"
                          ? "text-[#E5E5E5]"
                          : "text-[#8A8A8A] hover:text-[#E5E5E5]"
                          }`}
                      >
                        Buy
                        {tradeAction === "buy" && (
                          <div className="absolute bottom-[-12px] left-0 right-0 h-[2px] bg-[#E5E5E5]" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setTradeAction("sell")
                          setTradeSide(null)
                          setTradeAmount("")
                        }}
                        className={`text-xs sm:text-sm font-medium transition-colors relative ${tradeAction === "sell"
                          ? "text-[#E5E5E5]"
                          : "text-[#8A8A8A] hover:text-[#E5E5E5]"
                          }`}
                      >
                        Sell
                        {tradeAction === "sell" && (
                          <div className="absolute bottom-[-12px] left-0 right-0 h-[2px] bg-[#E5E5E5]" />
                        )}
                      </button>
                    </div>
                    <button className="text-sm text-[#E5E5E5] flex items-center gap-1 hover:opacity-80 transition-opacity">
                      Market
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  <div className="border-b border-border/20 -mt-3 mb-4" />

                  {/* Yes/No Selection */}
                  {tradeAction === "buy" ? (
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <button
                        onClick={() => setTradeSide("YES")}
                        className={`px-3 sm:px-4 py-2 sm:py-3 rounded text-xs sm:text-sm font-bold transition-all ${tradeSide === "YES"
                          ? "bg-neon-green text-black neon-glow-green"
                          : "glass-button text-[#8A8A8A] hover:neon-border-green hover:neon-text-green"
                          }`}
                      >
                        Yes {yesPercent.toFixed(1)}%
                      </button>
                      <button
                        onClick={() => setTradeSide("NO")}
                        className={`px-3 sm:px-4 py-2 sm:py-3 rounded text-xs sm:text-sm font-bold transition-all ${tradeSide === "NO"
                          ? "bg-neon-magenta text-white neon-glow-magenta"
                          : "glass-button text-[#8A8A8A] hover:neon-border-magenta hover:neon-text-magenta"
                          }`}
                      >
                        No {noPercent.toFixed(1)}%
                      </button>
                    </div>
                  ) : (
                    <div className="mb-4">
                      {loading ? (
                        <div className="p-4 text-center text-muted-foreground text-sm">
                          Loading your positions...
                        </div>
                      ) : (userYesPosition && userYesPosition.amount > 0n) || (userNoPosition && userNoPosition.amount > 0n) ? (
                        <>
                          {/* Show toggle if user has both positions, otherwise show single position */}
                          {(userYesPosition && userYesPosition.amount > 0n) && (userNoPosition && userNoPosition.amount > 0n) ? (
                            <div className="mb-3">
                              <label className="text-xs text-[#8A8A8A] mb-2 block">Select position to sell:</label>
                              <div className="grid grid-cols-2 gap-3">
                                <button
                                  onClick={() => {
                                    setSellSide("YES")
                                    setTradeAmount("") // Reset amount when switching
                                  }}
                                  className={`px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-bold transition-all ${sellSide === "YES"
                                    ? "bg-neon-green text-black neon-glow-green"
                                    : "glass-button text-[#8A8A8A] hover:neon-border-green hover:neon-text-green"
                                    }`}
                                >
                                  YES: {(Number(userYesPosition.amount) / LAMPORTS_PER_SOL).toFixed(4)} SOL
                                </button>
                                <button
                                  onClick={() => {
                                    setSellSide("NO")
                                    setTradeAmount("") // Reset amount when switching
                                  }}
                                  className={`px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-bold transition-all ${sellSide === "NO"
                                    ? "bg-neon-magenta text-white neon-glow-magenta"
                                    : "glass-button text-[#8A8A8A] hover:neon-border-magenta hover:neon-text-magenta"
                                    }`}
                                >
                                  NO: {(Number(userNoPosition.amount) / LAMPORTS_PER_SOL).toFixed(4)} SOL
                                </button>
                              </div>
                            </div>
                          ) : (
                            // Show single position info (auto-selected)
                            <div className="mb-3">
                              <label className="text-xs text-[#8A8A8A] mb-2 block">Your position to sell:</label>
                              <div className="flex gap-3">
                                {userYesPosition && userYesPosition.amount > 0n && (
                                  <div className="flex-1 px-4 py-2 rounded text-sm font-bold bg-neon-green text-black neon-glow-green text-center">
                                    YES: {(Number(userYesPosition.amount) / LAMPORTS_PER_SOL).toFixed(4)} SOL
                                  </div>
                                )}
                                {userNoPosition && userNoPosition.amount > 0n && (
                                  <div className="flex-1 px-4 py-2 rounded text-sm font-bold bg-neon-magenta text-white neon-glow-magenta text-center">
                                    NO: {(Number(userNoPosition.amount) / LAMPORTS_PER_SOL).toFixed(4)} SOL
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Show selected position info */}
                          {sellSide && (
                            <div className="mb-3 p-3 glass rounded text-xs">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[#8A8A8A]">Your {sellSide} Position:</span>
                                <span className="text-[#E5E5E5] font-mono flex items-center gap-1">
                                  <SolanaLogo size={12} />
                                  {(Number((sellSide === "YES" ? userYesPosition : userNoPosition)?.amount || 0n) / LAMPORTS_PER_SOL).toFixed(4)} SOL
                                </span>
                              </div>
                              <div className="mt-2 text-amber-500/80 text-xs">
                                ⚠️ 0.01 SOL fee applies to pre-resolution sells
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-500">
                          <p>You don't have a position on this market.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Amount Input Section */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                      <label className="text-xs sm:text-sm text-[#E5E5E5]">
                        Amount (SOL)
                      </label>
                      <div className="text-2xl sm:text-3xl font-mono text-[#8A8A8A] font-light flex items-center gap-1">
                        <SolanaLogo size={16} />
                        {betAmount > 0 ? betAmount.toFixed(2) : "0.00"}
                      </div>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={tradeAction === "sell" && sellSide ? Number((sellSide === "YES" ? userYesPosition : userNoPosition)?.amount || 0n) / LAMPORTS_PER_SOL : undefined}
                      value={tradeAmount}
                      onChange={(e) => {
                        const value = e.target.value
                        if (tradeAction === "sell" && sellSide) {
                          const selectedPosition = sellSide === "YES" ? userYesPosition : userNoPosition
                          if (selectedPosition) {
                            const positionAmountSol = Number(selectedPosition.amount) / LAMPORTS_PER_SOL
                            const numValue = parseFloat(value)
                            if (!isNaN(numValue) && numValue > positionAmountSol) {
                              setTradeAmount(positionAmountSol.toFixed(4))
                              return
                            }
                          }
                        }
                        setTradeAmount(value)
                      }}
                      placeholder="0.00"
                      className="w-full glass-input rounded px-2 sm:px-3 py-2 text-xs sm:text-sm text-[#E5E5E5] placeholder:text-[#8A8A8A] mb-2"
                      disabled={tradeLoading || tradeSubmitted || (tradeAction === "sell" && !sellSide)}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAmountQuickAdd(0.1)}
                        className="flex-1 px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs text-[#8A8A8A] glass-button rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={
                          tradeLoading ||
                          tradeSubmitted ||
                          (tradeAction === "sell" && !sellSide) ||
                          (tradeAction === "sell" && sellSide ? (() => {
                            const selectedPosition = sellSide === "YES" ? userYesPosition : userNoPosition
                            return !!(selectedPosition && parseFloat(tradeAmount || "0") >= Number(selectedPosition.amount) / LAMPORTS_PER_SOL)
                          })() : false)
                        }
                      >
                        +0.1
                      </button>
                      <button
                        onClick={() => handleAmountQuickAdd(0.5)}
                        className="flex-1 px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs text-[#8A8A8A] glass-button rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={
                          tradeLoading ||
                          tradeSubmitted ||
                          (tradeAction === "sell" && !sellSide) ||
                          (tradeAction === "sell" && sellSide ? (() => {
                            const selectedPosition = sellSide === "YES" ? userYesPosition : userNoPosition
                            return !!(selectedPosition && parseFloat(tradeAmount || "0") >= Number(selectedPosition.amount) / LAMPORTS_PER_SOL)
                          })() : false)
                        }
                      >
                        +0.5
                      </button>
                      <button
                        onClick={() => handleAmountQuickAdd(1)}
                        className="flex-1 px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs text-[#8A8A8A] glass-button rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={
                          tradeLoading ||
                          tradeSubmitted ||
                          (tradeAction === "sell" && !sellSide) ||
                          (tradeAction === "sell" && sellSide ? (() => {
                            const selectedPosition = sellSide === "YES" ? userYesPosition : userNoPosition
                            return !!(selectedPosition && parseFloat(tradeAmount || "0") >= Number(selectedPosition.amount) / LAMPORTS_PER_SOL)
                          })() : false)
                        }
                      >
                        +1
                      </button>
                      <button
                        onClick={handleMaxAmount}
                        className="flex-1 px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs text-[#8A8A8A] glass-button rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={
                          tradeLoading ||
                          tradeSubmitted ||
                          (tradeAction === "sell" && !sellSide) ||
                          (tradeAction === "buy" && (!walletAddress || !connection))
                        }
                      >
                        Max
                      </button>
                    </div>
                    {betAmount > 0 && tradeSide && !tradeLoading && !tradeSubmitted && (
                      <div className="mt-3 text-center space-y-1">
                        <div className="text-lg font-bold text-neon-green">
                          To Win: {potentialPayout === Infinity ? '∞' : potentialPayout.toFixed(4)} SOL
                          {potentialPayout === Infinity && (
                            <span className="text-xs text-orange-400 block">Market too thin</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400">
                          Total Payout: {(betAmount + (potentialPayout === Infinity ? 0 : potentialPayout)).toFixed(4)} SOL
                        </div>
                        <div className="text-xs text-gray-500">
                          {tradeSide === 'YES' ? '(if YES wins)' : '(if NO wins)'}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Error Message */}
                  {tradeError && (
                    <div className="mb-3 text-xs text-red-500 bg-red-500/10 border border-red-500/30 rounded px-2 py-1.5">
                      {tradeError}
                    </div>
                  )}

                  {/* Transaction Status */}
                  {tradeSubmitted && txSignature && !tradeError && (
                    <div className="mb-3 text-xs text-[#8A8A8A] bg-[#0B0B0D] border border-border/30 rounded px-2 py-1.5">
                      <div className="text-[#E5E5E5] mb-1">Transaction submitted</div>
                      <a
                        href={`https://solscan.io/tx/${txSignature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#6B9E78] hover:underline"
                      >
                        View on Solscan
                      </a>
                    </div>
                  )}

                  <Button
                    onClick={handleTrade}
                    className={`w-full py-2.5 sm:py-3 text-xs sm:text-sm font-bold mb-3 transition-all ${tradeAction === "buy"
                      ? tradeSide === "YES"
                        ? "bg-neon-green hover:bg-neon-green/90 text-black neon-glow-green"
                        : tradeSide === "NO"
                          ? "bg-neon-magenta hover:bg-neon-magenta/90 text-white neon-glow-magenta"
                          : "bg-neon-green hover:bg-neon-green/90 text-black neon-glow-green"
                      : "bg-neon-magenta hover:bg-neon-magenta/90 text-white neon-glow-magenta"
                      }`}
                    disabled={
                      tradeAction === "buy"
                        ? (!tradeSide || !walletConnected || !tradeAmount || tradeLoading || tradeSubmitted || market.resolved)
                        : (!sellSide || !walletConnected || !tradeAmount || tradeLoading || tradeSubmitted || market.resolved)
                    }
                  >
                    {tradeLoading ? "Processing..." : tradeSubmitted ? "Submitted..." : tradeAction === "buy" ? `Buy ${tradeSide || ""}` : "Sell Shares"}
                  </Button>

                  {!walletConnected && (
                    <div className="text-center py-4 text-xs text-[#8A8A8A] mt-4">
                      Connect wallet to trade
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
      />
    </>
  )
}