"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { TopBar } from "@/components/top-bar"
import { WalletModal } from "@/components/wallet-modal"
import { useWallet } from "@/components/wallet-provider"
import { Button } from "@/components/ui/button"
import { PublicKey } from "@solana/web3.js"
import { fetchMarketByPda } from "@/lib/anchor/markets"
import * as anchor from "@coral-xyz/anchor"
import { LAMPORTS_PER_SOL } from "@solana/web3.js"
import { TrendingUp, MessageSquare, Link, Reply } from "lucide-react"
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

interface ChainMarketData {
  marketPda: PublicKey
  tokenMint: PublicKey
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
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<"hot" | "new" | null>(null)
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

  // Fetch market from chain
  const fetchMarket = async (isInitialLoad = false) => {
    if (!id || !connection) return

    try {
      // Only show loading state on initial load, not on polling updates
      if (isInitialLoad) {
      setLoading(true)
      }
      setError(null)
      
      const marketPda = new PublicKey(id)
      const marketData = await fetchMarketByPda(connection, wallet, marketPda)
      
      if (!marketData) {
        if (isInitialLoad) {
        setError("Market not found")
        }
        return
      }

      setMarket({
        marketPda: marketData.marketPda,
        tokenMint: marketData.tokenMint,
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
  }

  // Initial load
  useEffect(() => {
    fetchMarket(true)
  }, [id, connection, wallet])

  // Real-time polling every 5 seconds (optimized frequency)
  useEffect(() => {
    if (!connection || !id) return

    const interval = setInterval(() => {
      fetchMarket(false) // Don't show loading on polling updates
    }, 5000) // Poll every 5 seconds (reduced from 3 to reduce load)

    return () => clearInterval(interval)
  }, [connection, id])

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
  }, [market, walletAddress, connection])

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
  }, [userYesPosition, userNoPosition, tradeAction, sellSide])

  const yesPoolSol = market ? Number(market.yesPool) / LAMPORTS_PER_SOL : 0
  const noPoolSol = market ? Number(market.noPool) / LAMPORTS_PER_SOL : 0
  const totalPool = yesPoolSol + noPoolSol
  const yesPercent = totalPool > 0 ? (yesPoolSol / totalPool) * 100 : 50
  const noPercent = totalPool > 0 ? (noPoolSol / totalPool) * 100 : 50

  const question = market 
    ? `Will ${market.tokenMint.toString().slice(0, 4)}...${market.tokenMint.toString().slice(-4)} hit $${(Number(market.targetMarketCap) / 1_000_000_000).toFixed(1)}B?`
    : "Loading..."

  const resolveDate = market ? new Date(Number(market.endTimestamp) * 1000) : new Date()

  const copyMarketLink = () => {
    if (typeof window !== "undefined") {
      const marketUrl = window.location.href
      navigator.clipboard.writeText(marketUrl)
      // Optional: You could add a toast notification here
    }
  }

  // Calculate potential payout in SOL
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
      const selectedPosition = sellSide === "YES" ? userYesPosition : sellSide === "NO" ? userNoPosition : null
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
          amountLamports
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
  const potentialPayout = tradeSide ? calculatePayout(tradeSide, betAmount) : 0

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
      
      // Convert market cap to lamports (assuming it's in billions, convert to base units)
      // If input is in billions (e.g., 5.0 for $5B), multiply by 1e9
      const finalMarketCapLamports = BigInt(Math.floor(marketCapValue * 1_000_000_000))

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
  const loadCommentsForMarket = useCallback(() => {
    if (!market) return
    const marketPdaStr = market.marketPda.toString()
    const loaded = loadComments(marketPdaStr)
    setComments(loaded)
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
      const newComment = createComment(marketPdaStr, walletAddress, commentInput)
      saveComment(newComment)
      
      // Reload comments
      loadCommentsForMarket()
      
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
      const newReply = createComment(marketPdaStr, walletAddress, replyText, parentId)
      saveComment(newReply)
      
      // Reload comments
      loadCommentsForMarket()
      
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
  }, [marketPdaStr]) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll comments every 10 seconds (reduced frequency to avoid overwriting)
  useEffect(() => {
    if (!marketPdaStr) return

    const interval = setInterval(() => {
      loadCommentsForMarket()
    }, 10000) // Poll every 10 seconds (reduced from 5)

    return () => clearInterval(interval)
  }, [marketPdaStr]) // eslint-disable-line react-hooks/exhaustive-deps

  // Check if user is admin (for now, allow anyone - can be restricted later)
  const isAdmin = true // TODO: Add admin check via env variable or wallet whitelist

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
        <main className="flex items-center justify-center py-16">
          <p className="text-muted-foreground">Loading market from chain...</p>
        </main>
      ) : error ? (
        <main className="flex items-center justify-center py-16">
          <div className="text-center space-y-2">
            <p className="text-red-500">{error}</p>
            <Button onClick={fetchMarket} variant="outline">Retry</Button>
          </div>
        </main>
      ) : !market ? (
        <main className="flex items-center justify-center py-16">
          <p className="text-muted-foreground">Market not found</p>
        </main>
      ) : (
        <main className="fixed inset-0 top-[140px] sm:top-[140px] overflow-hidden">
          <div className="mx-auto max-w-7xl px-3 sm:px-4 h-full">
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-3 h-full">
              {/* Left: Chart and Details */}
              <div className="lg:col-span-2 flex flex-col h-full overflow-hidden">
                {/* Fixed Question Header - Does not scroll, spans only left column */}
              <div className="flex-shrink-0 z-30 bg-[#0F0F11] border-b border-border/30 py-3 mb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h1 className="text-base sm:text-lg font-semibold text-[#E5E5E5] mb-1 truncate">
                      {question}
                    </h1>
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      {market.resolved ? (
                        <div className={`text-xs font-semibold px-2 py-1 rounded ${
                          market.outcome 
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
                          <div className="flex items-center gap-1 text-blue-500 text-xs">
                            <span>&lt;{yesPercent.toFixed(0)}% chance</span>
                            <TrendingUp className="h-3 w-3" />
                            <span className="text-[#6B9E78]">{yesPercent.toFixed(0)}%</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
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
              <div className="flex-1 overflow-y-auto space-y-4 sm:space-y-6 pb-4 sm:pb-6 scrollbar-hide">
                {/* Resolution UI - Show if market expired and not resolved, or if resolved show outcome */}
                {isAdmin && !market.resolved && Math.floor(Date.now() / 1000) >= Number(market.endTimestamp) && (
                  <div className="border border-amber-500/30 bg-amber-500/10 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-amber-500 mb-3">Resolve Market</h3>
                    <div className="space-y-3">
                  <div>
                        <label className="text-xs text-[#8A8A8A] mb-1 block">Final Market Cap (Billions)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={finalMarketCap}
                          onChange={(e) => setFinalMarketCap(e.target.value)}
                          placeholder="e.g., 5.2"
                          className="w-full bg-[#0B0B0D] border border-border/30 rounded px-3 py-2 text-sm text-[#E5E5E5] placeholder:text-[#8A8A8A]"
                          disabled={resolving}
                        />
                        <p className="text-xs text-[#8A8A8A] mt-1">
                          Target: ${(Number(market.targetMarketCap) / 1_000_000_000).toFixed(1)}B
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
                
                {/* Chart Section - DexScreener Only */}
                <div className="border border-border/30 bg-[#0F0F11] rounded-lg p-2 sm:p-4">
                  {market ? (
                    <div className="rounded-xl overflow-hidden border border-white/10">
                      <iframe
                        src={`https://dexscreener.com/solana/${market.tokenMint.toString()}?embed=1&theme=dark&trades=0&info=0`}
                        className="w-full h-[240px] sm:h-[320px] border-0"
                        title="DexScreener Chart"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div className="h-[240px] sm:h-[320px] flex items-center justify-center bg-[#0B0B0D] rounded border border-border/20">
                      <p className="text-muted-foreground text-xs sm:text-sm">Loading chart...</p>
                    </div>
                  )}
                </div>

                {/* Rules Section - Matching Polymarket Style */}
                {market && (
                  <div className="border border-border/30 bg-[#1a1a1a] rounded-lg p-3 sm:p-4">
                    <h3 className="text-base sm:text-lg font-semibold text-[#E5E5E5] mb-2 sm:mb-3">Rules</h3>
                    
                    {/* Generate default rules based on market data */}
                    {(() => {
                      const tokenAddress = market.tokenMint.toString()
                      const targetCap = (Number(market.targetMarketCap) / 1_000_000_000).toFixed(1)
                      const resolveTime = new Date(Number(market.endTimestamp) * 1000).toLocaleString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        timeZoneName: "short"
                      })
                      
                      const defaultRules = `This market will resolve to "Yes" if the token at address ${tokenAddress.slice(0, 8)}...${tokenAddress.slice(-8)} reaches or exceeds $${targetCap}B market cap at any point before ${resolveTime}.

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
                            className="text-[#3BA4FF] text-sm mt-3 flex items-center gap-1 hover:text-[#5BB5FF] transition-colors"
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
              <div className="border border-border/30 bg-[#0F0F11] rounded-lg p-3 sm:p-4">
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
                      className="w-full bg-[#0B0B0D] border border-border/30 rounded px-2 sm:px-3 py-2 text-xs sm:text-sm text-[#E5E5E5] placeholder:text-[#8A8A8A] resize-none focus:outline-none focus:ring-1 focus:ring-[#6B9E78]/50"
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
                  <div className="mb-4 p-3 bg-[#0B0B0D] border border-border/30 rounded text-center">
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
                          className="bg-[#0B0B0D] border border-border/20 rounded-lg p-3 hover:border-border/40 transition-colors"
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
                                className="w-full bg-[#0B0B0D] border border-border/30 rounded px-3 py-2 text-xs text-[#E5E5E5] placeholder:text-[#8A8A8A] resize-none focus:outline-none focus:ring-1 focus:ring-[#6B9E78]/50"
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
                                  className="bg-[#0B0B0D]/50 border border-border/10 rounded p-2 ml-4"
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
                <div className="sticky top-0 border border-border/30 bg-[#0F0F11] rounded-lg p-3 sm:p-4">
                {/* Buy/Sell Tabs and Market Dropdown */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/20">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => {
                        setTradeAction("buy")
                        setTradeSide(null)
                        setTradeAmount("")
                      }}
                      className={`text-xs sm:text-sm font-medium transition-colors relative ${
                        tradeAction === "buy"
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
                      className={`text-xs sm:text-sm font-medium transition-colors relative ${
                        tradeAction === "sell"
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
                      className={`px-3 sm:px-4 py-2 sm:py-3 rounded text-xs sm:text-sm font-medium transition-colors ${
                        tradeSide === "YES"
                          ? "bg-[#6B9E78] text-white"
                          : "bg-[#0B0B0D] text-[#8A8A8A] border border-border/30 hover:border-border/50"
                      }`}
                    >
                      Yes {yesPercent.toFixed(1)}%
                    </button>
                    <button
                      onClick={() => setTradeSide("NO")}
                      className={`px-3 sm:px-4 py-2 sm:py-3 rounded text-xs sm:text-sm font-medium transition-colors ${
                        tradeSide === "NO"
                          ? "bg-[#A67C7C] text-white"
                          : "bg-[#0B0B0D] text-[#8A8A8A] border border-border/30 hover:border-border/50"
                      }`}
                    >
                      No {noPercent.toFixed(1)}%
                    </button>
                    </div>
                ) : (
                  <div className="mb-4">
                    {(userYesPosition && userYesPosition.amount > 0n) || (userNoPosition && userNoPosition.amount > 0n) ? (
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
                                className={`px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-medium transition-colors ${
                                  sellSide === "YES"
                                    ? "bg-[#6B9E78] text-white"
                                    : "bg-[#0B0B0D] text-[#8A8A8A] border border-border/30 hover:border-border/50"
                                }`}
                              >
                                YES: {(Number(userYesPosition.amount) / LAMPORTS_PER_SOL).toFixed(4)} SOL
                              </button>
                              <button
                                onClick={() => {
                                  setSellSide("NO")
                                  setTradeAmount("") // Reset amount when switching
                                }}
                                className={`px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-medium transition-colors ${
                                  sellSide === "NO"
                                    ? "bg-[#A67C7C] text-white"
                                    : "bg-[#0B0B0D] text-[#8A8A8A] border border-border/30 hover:border-border/50"
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
                                <div className="flex-1 px-4 py-2 rounded text-sm font-medium bg-[#6B9E78] text-white text-center">
                                  YES: {(Number(userYesPosition.amount) / LAMPORTS_PER_SOL).toFixed(4)} SOL
            </div>
                              )}
                              {userNoPosition && userNoPosition.amount > 0n && (
                                <div className="flex-1 px-4 py-2 rounded text-sm font-medium bg-[#A67C7C] text-white text-center">
                                  NO: {(Number(userNoPosition.amount) / LAMPORTS_PER_SOL).toFixed(4)} SOL
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Show selected position info */}
                        {sellSide && (
                          <div className="mb-3 p-3 bg-[#0B0B0D] border border-border/30 rounded text-xs">
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
                    className="w-full bg-[#0B0B0D] border border-border/30 rounded px-2 sm:px-3 py-2 text-xs sm:text-sm text-[#E5E5E5] placeholder:text-[#8A8A8A] mb-2"
                    disabled={tradeLoading || tradeSubmitted || (tradeAction === "sell" && !sellSide)}
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleAmountQuickAdd(0.1)}
                      className="flex-1 px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs text-[#8A8A8A] bg-[#0B0B0D] border border-border/30 rounded hover:border-border/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={
                        tradeLoading || 
                        tradeSubmitted || 
                        (tradeAction === "sell" && !sellSide) ||
                        (tradeAction === "sell" && sellSide && (() => {
                          const selectedPosition = sellSide === "YES" ? userYesPosition : userNoPosition
                          return selectedPosition && parseFloat(tradeAmount || "0") >= Number(selectedPosition.amount) / LAMPORTS_PER_SOL
                        })())
                      }
                    >
                      +0.1
                    </button>
                    <button 
                      onClick={() => handleAmountQuickAdd(0.5)}
                      className="flex-1 px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs text-[#8A8A8A] bg-[#0B0B0D] border border-border/30 rounded hover:border-border/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={
                        tradeLoading || 
                        tradeSubmitted || 
                        (tradeAction === "sell" && !sellSide) ||
                        (tradeAction === "sell" && sellSide && (() => {
                          const selectedPosition = sellSide === "YES" ? userYesPosition : userNoPosition
                          return selectedPosition && parseFloat(tradeAmount || "0") >= Number(selectedPosition.amount) / LAMPORTS_PER_SOL
                        })())
                      }
                    >
                      +0.5
                    </button>
                    <button 
                      onClick={() => handleAmountQuickAdd(1)}
                      className="flex-1 px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs text-[#8A8A8A] bg-[#0B0B0D] border border-border/30 rounded hover:border-border/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={
                        tradeLoading || 
                        tradeSubmitted || 
                        (tradeAction === "sell" && !sellSide) ||
                        (tradeAction === "sell" && sellSide && (() => {
                          const selectedPosition = sellSide === "YES" ? userYesPosition : userNoPosition
                          return selectedPosition && parseFloat(tradeAmount || "0") >= Number(selectedPosition.amount) / LAMPORTS_PER_SOL
                        })())
                      }
                    >
                      +1
                    </button>
                    <button 
                      onClick={handleMaxAmount}
                      className="flex-1 px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs text-[#8A8A8A] bg-[#0B0B0D] border border-border/30 rounded hover:border-border/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <div className="mt-3 text-xs text-[#8A8A8A] text-center">
                      To win: <span className="font-mono text-[#E5E5E5] flex items-center justify-center gap-1">
                        <SolanaLogo size={12} />
                        {potentialPayout.toFixed(2)} SOL
                      </span>
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
                      href={`https://solscan.io/tx/${txSignature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#6B9E78] hover:underline"
                    >
                      View on Solscan
                    </a>
                  </div>
                )}

                {/* Trade Button */}
                <Button
                  onClick={handleTrade}
                  className={`w-full py-2.5 sm:py-3 text-xs sm:text-sm font-medium mb-3 ${
                    tradeAction === "buy"
                      ? tradeSide === "YES"
                        ? "bg-[#6B9E78] hover:bg-[#6B9E78]/90 text-white"
                        : tradeSide === "NO"
                        ? "bg-[#A67C7C] hover:bg-[#A67C7C]/90 text-white"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-orange-600 hover:bg-orange-700 text-white"
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
