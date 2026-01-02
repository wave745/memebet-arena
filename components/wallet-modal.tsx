"use client"

import { useState, useEffect, useMemo } from "react"
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js"

const PROGRAM_ID = new PublicKey("6fQsRy2d91RaaHZrd9ymmaQuR4bWDL7x5hD6WqpdgLMV")
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fetchUserPositions, type PositionData } from "@/lib/solana/positions"
import { fetchMarketByPda } from "@/lib/anchor/markets"
import { useWallet } from "./wallet-provider"
import { Copy, ExternalLink, ArrowUpRight, ArrowDownRight, Share2 } from "lucide-react"
import { SolanaLogo } from "./solana-logo"
import { generatePnLImage, type PnLData } from "@/lib/pnl-generator"
import { Transaction } from "@solana/web3.js"
import { buildRedeemInstruction } from "@/lib/solana/instructions"
import { useRouter } from "next/navigation"
import { formatMarketCapShort } from "@/lib/utils/format-market-cap"

interface WalletModalProps {
  isOpen: boolean
  onClose: () => void
}

type Tab = "active" | "history" | "transactions"

const formatAddress = (addr: PublicKey | string) => {
  const str = typeof addr === "string" ? addr : addr.toString()
  return `${str.slice(0, 4)}...${str.slice(-4)}`
}

interface TransactionData {
  signature: string
  slot: number
  blockTime: number | null
  err: any
  memo: string | null
  type?: "buy" | "sell" | "claim" | "resolve" | "unknown"
  marketPda?: string
  amount?: number
  outcome?: boolean
  fee?: number
  sortIndex?: number
}

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const router = useRouter()
  const { walletAddress, connection, solBalance, wallet } = useWallet()
  const [activeTab, setActiveTab] = useState<Tab>("active")
  const [positions, setPositions] = useState<PositionData[]>([])
  const [loading, setLoading] = useState(false)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [markets, setMarkets] = useState<Map<string, any>>(new Map())
  const [transactions, setTransactions] = useState<TransactionData[]>([])
  const [txLoading, setTxLoading] = useState(false)

  // Track if this is the initial load
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [sharingLoading, setSharingLoading] = useState<string | null>(null)

  const handleShare = async (data: PnLData, positionId: string) => {
    setSharingLoading(positionId)
    try {
      const dataUrl = await generatePnLImage(data)
      const link = document.createElement("a")
      link.download = `pnl-${positionId.slice(0, 8)}.png`
      link.href = dataUrl
      link.click()
    } catch (error) {
      console.error("Failed to generate PnL image:", error)
    } finally {
      setSharingLoading(null)
    }
  }

  useEffect(() => {
    if (isOpen && walletAddress && connection) {
      setIsInitialLoad(true)
      loadPositions(true) // Initial load with loading state
      loadTransactions(true) // Initial load with loading state if on transactions tab

      // Poll positions every 15 seconds when modal is open (reduced frequency)
      const interval = setInterval(() => {
        loadPositions(false) // Polling updates without loading state
        loadTransactions(false) // Polling updates without loading state
      }, 15000) // Increased to 15 seconds

      return () => clearInterval(interval)
    } else {
      setPositions([])
      setMarkets(new Map())
      setTransactions([])
      setIsInitialLoad(true)
    }
  }, [isOpen, walletAddress, connection]) // Removed activeTab to prevent unnecessary reloads

  const loadPositions = async (showLoading = false) => {
    if (!walletAddress || !connection) return

    if (showLoading) {
      setLoading(true)
      setIsInitialLoad(true)
    }

    try {
      // Fetch all positions for this user
      const userPositions = await fetchUserPositions(connection, new PublicKey(walletAddress))

      // Always update positions (amounts may have changed)
      setPositions(userPositions)

      // Get unique market PDAs (avoid fetching same market multiple times)
      const uniqueMarketPdas = Array.from(new Set(userPositions.map(p => p.marketPda.toString())))

      // Fetch all market data in parallel (much faster than sequential)
      // Always refresh to get latest pool data
      const marketPromises = uniqueMarketPdas.map(async (marketPdaStr) => {
        try {
          const marketPda = new PublicKey(marketPdaStr)
          const market = await fetchMarketByPda(connection, null, marketPda)
          return market ? [marketPdaStr, market] as const : null
        } catch (e) {
          console.warn("Failed to fetch market:", marketPdaStr)
          return null
        }
      })

      const marketResults = await Promise.all(marketPromises)
      const marketMap = new Map<string, any>()
      marketResults.forEach((result) => {
        if (result) {
          const [pdaStr, marketData] = result
          // TODO: Get ticker from API or user input - no hardcoded data
          marketMap.set(pdaStr, { ...marketData, ticker: 'UNKNOWN' })
        }
      })

      // Update markets map, preserving existing entries for markets not in current positions
      setMarkets((prevMarkets) => {
        const newMap = new Map(prevMarkets)
        marketMap.forEach((market, key) => {
          newMap.set(key, market)
        })
        return newMap
      })
    } catch (error) {
      console.error("Failed to load positions:", error)
    } finally {
      if (showLoading) {
        setLoading(false)
        setIsInitialLoad(false)
      }
    }
  }

  // Create a map of position PDA to most recent transaction slot
  // Use useMemo to recalculate when transactions or positions change
  // For sorting: use slot numbers from signatures (higher = newer)
  const positionTimestamps = useMemo(() => {
    const timestamps = new Map<string, { slot: number; sortIndex: number }>()

    // Match positions to transactions by marketPda if available
    transactions.forEach((tx, txIndex) => {
      if (tx.marketPda) {
        positions.forEach((pos) => {
          if (pos.marketPda.toString() === tx.marketPda) {
            const current = timestamps.get(pos.positionPda.toString())
            const currentSortIndex = current?.sortIndex ?? 999999
            const txSortIndex = (tx as any).sortIndex ?? txIndex

            // Lower sortIndex = newer (transactions are sorted newest first)
            if (txSortIndex < currentSortIndex) {
              timestamps.set(pos.positionPda.toString(), {
                slot: tx.slot,
                sortIndex: txSortIndex,
              })
            }
          }
        })
      }
    })

    // For positions without matching transactions, use a default sort order
    // This ensures all positions get sorted
    positions.forEach((pos, posIndex) => {
      if (!timestamps.has(pos.positionPda.toString())) {
        // Use a high sortIndex so unmatched positions appear last
        timestamps.set(pos.positionPda.toString(), {
          slot: 0,
          sortIndex: 999999 + posIndex,
        })
      }
    })

    return timestamps
  }, [transactions, positions])

  // Split positions into active and history
  // Active: positions with amount > 0 on unresolved markets
  // Sort active positions by most recent transaction (newest first)
  const activePositions = useMemo(() => {
    const filtered = positions.filter((pos) => {
      const market = markets.get(pos.marketPda.toString())
      const hasAmount = pos.amount > 0n
      return market && !market.resolved && hasAmount
    })

    // Sort by most recent transaction (newest first)
    return filtered.sort((a, b) => {
      const dataA = positionTimestamps.get(a.positionPda.toString())
      const dataB = positionTimestamps.get(b.positionPda.toString())

      // Use sortIndex as primary (lower = newer, since transactions are sorted newest first)
      if (dataA && dataB) {
        return dataA.sortIndex - dataB.sortIndex // Lower index first (newer)
      }

      // If only one has data, prioritize it
      if (dataA && !dataB) return -1
      if (dataB && !dataA) return 1

      // If neither has data, maintain original order
      return 0
    })
  }, [positions, markets, positionTimestamps])

  // History: positions on resolved markets OR positions with zero amount (sold out)
  const historyPositions = positions.filter((pos) => {
    const market = markets.get(pos.marketPda.toString())
    const hasAmount = pos.amount > 0n
    // Include if: market is resolved OR position has zero amount (sold out)
    if (market) {
      return market.resolved || !hasAmount
    }
    // If market data unavailable but position has zero amount, show in history
    return !hasAmount
  })

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr)
  }

  const loadTransactions = async (showLoading = false) => {
    if (!walletAddress || !connection) return

    if (showLoading && activeTab === "transactions") {
      setTxLoading(true)
    }

    try {
      const userPubkey = new PublicKey(walletAddress)
      // Fetch last 50 transaction signatures (lightweight, no RPC calls for details)
      const signatures = await connection.getSignaturesForAddress(userPubkey, { limit: 50 })

      // For sorting: use signatures with slot numbers (no expensive RPC calls)
      // Only fetch full transaction details if we're on transactions tab
      if (activeTab === "transactions") {
        // Parse transactions to extract marketPda for display
        // Process in smaller batches with delays to avoid rate limits
        const txData: TransactionData[] = []
        const BATCH_SIZE = 5
        const DELAY_MS = 500

        for (let i = 0; i < signatures.length; i += BATCH_SIZE) {
          const batch = signatures.slice(i, i + BATCH_SIZE)

          const batchPromises = batch.map(async (sig, batchIndex) => {
            let marketPda: string | undefined

            try {
              // Fetch transaction details
              const tx = await connection.getTransaction(sig.signature, {
                commitment: "confirmed",
                maxSupportedTransactionVersion: 0,
              })

              if (tx?.transaction?.message) {
                const message = tx.transaction.message
                const accountKeys = message.staticAccountKeys || []

                // Try to get instructions
                let instructions: any[] = []
                if ('instructions' in message && Array.isArray(message.instructions)) {
                  instructions = message.instructions
                } else if ('compiledInstructions' in message && Array.isArray(message.compiledInstructions)) {
                  // V0 format
                  instructions = message.compiledInstructions.map((cix: any) => ({
                    programIdIndex: cix.programIdIndex,
                    accountKeyIndexes: cix.accountKeyIndexes || [],
                  }))
                }

                // Check each instruction
                for (const ix of instructions) {
                  let programId: PublicKey | null = null
                  let firstAccount: PublicKey | null = null

                  if ('programId' in ix && ix.programId) {
                    programId = ix.programId instanceof PublicKey ? ix.programId : new PublicKey(ix.programId)
                    if (ix.accounts && ix.accounts.length > 0) {
                      const firstAcc = ix.accounts[0]
                      firstAccount = firstAcc instanceof PublicKey ? firstAcc : new PublicKey(firstAcc)
                    }
                  } else if ('programIdIndex' in ix && typeof ix.programIdIndex === 'number') {
                    if (accountKeys[ix.programIdIndex]) {
                      programId = accountKeys[ix.programIdIndex]
                    }
                    if (ix.accountKeyIndexes && ix.accountKeyIndexes.length > 0 && accountKeys[ix.accountKeyIndexes[0]]) {
                      firstAccount = accountKeys[ix.accountKeyIndexes[0]]
                    }
                  }

                  if (programId && programId.equals && programId.equals(PROGRAM_ID) && firstAccount) {
                    marketPda = firstAccount.toString()
                    break
                  }
                }
              }
            } catch (e: any) {
              // Handle rate limit errors
              if (e?.message?.includes('429') || e?.status === 429) {
                throw e // Re-throw to handle at batch level
              }
            }

            return {
              signature: sig.signature,
              slot: sig.slot,
              blockTime: sig.blockTime ?? null,
              err: sig.err,
              memo: sig.memo || null,
              marketPda,
              sortIndex: i + batchIndex,
            }
          })

          try {
            const batchResults = await Promise.all(batchPromises)
            txData.push(...batchResults)
          } catch (e: any) {
            // If batch fails due to rate limit, add delay and continue with remaining
            if (e?.message?.includes('429') || e?.status === 429) {
              await new Promise(resolve => setTimeout(resolve, 2000))
              // Add signatures without details
              batch.forEach((sig, batchIndex) => {
                txData.push({
                  signature: sig.signature,
                  slot: sig.slot,
                  blockTime: sig.blockTime ?? null,
                  err: sig.err,
                  memo: sig.memo || null,
                  sortIndex: i + batchIndex,
                })
              })
            }
          }

          // Delay between batches
          if (i + BATCH_SIZE < signatures.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_MS))
          }
        }

        setTransactions(txData)
      } else {
        // For sorting only: use signatures with slot numbers (no RPC calls)
        // Transactions are already sorted newest first by Solana
        const txData: TransactionData[] = signatures.map((sig, index) => ({
          signature: sig.signature,
          slot: sig.slot,
          blockTime: sig.blockTime ?? null,
          err: sig.err,
          memo: sig.memo || null,
          sortIndex: index,
        }))
        setTransactions(txData)
      }
    } catch (error) {
      console.error("Failed to load transactions:", error)
      setTransactions([])
    } finally {
      if (showLoading && activeTab === "transactions") {
        setTxLoading(false)
      }
    }
  }

  const handleClaim = async (position: PositionData, marketPda: PublicKey) => {
    if (!walletAddress || !connection || !wallet) {
      setClaimError("Wallet not connected")
      return
    }

    setClaiming(position.positionPda.toString())
    setClaimError(null)

    try {
      const userPubkey = new PublicKey(walletAddress)
      const marketPdaPubkey = new PublicKey(marketPda)
      const positionPda = new PublicKey(position.positionPda)

      // Build redeem instruction
      const instruction = buildRedeemInstruction(
        marketPdaPubkey,
        positionPda,
        userPubkey,
        position.outcome
      )

      const transaction = new Transaction().add(instruction)
      const { blockhash } = await connection.getLatestBlockhash("confirmed")
      transaction.recentBlockhash = blockhash
      transaction.feePayer = userPubkey

      // Sign transaction
      const signedTransaction = await wallet.signTransaction(transaction)

      // Send transaction
      const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      })

      // Wait for confirmation
      await connection.confirmTransaction(signature, "confirmed")

      // Refresh positions
      await loadPositions()

      setClaiming(null)
    } catch (error: any) {
      console.error("Claim error:", error)
      let errorMsg = "Failed to claim winnings"
      if (error.message) {
        if (error.message.includes("User rejected")) {
          setClaimError(null)
          setClaiming(null)
          return
        } else if (error.message.includes("MarketNotResolved")) {
          errorMsg = "Market not resolved yet"
        } else if (error.message.includes("PositionNotWinner")) {
          errorMsg = "This position did not win"
        } else if (error.message.includes("PositionAlreadyClaimed")) {
          errorMsg = "Winnings already claimed"
        } else {
          errorMsg = error.message.slice(0, 100)
        }
      }
      setClaimError(errorMsg)
      setClaiming(null)
    }
  }

  if (!walletAddress) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-[95vw] sm:w-[85vw] md:w-[75vw] h-[65vh] sm:h-[70vh] max-h-[600px] flex flex-col p-0 gap-0 opaque-panel shining-modal">
        <DialogHeader className="px-4 sm:px-6 pt-3 pb-2 flex-shrink-0 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm sm:text-base font-mono truncate">
                  {formatAddress(walletAddress)}
                </DialogTitle>
                <button
                  onClick={() => copyAddress(walletAddress)}
                  className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                  title="Copy address"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <SolanaLogo size={10} />
                <span>{solBalance.toFixed(2)} SOL</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-xs flex-shrink-0 h-7 w-7 p-0"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-border px-4 sm:px-6 flex-shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab("active")}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "active"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
          >
            Active ({activePositions.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "history"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
          >
            History ({historyPositions.length})
          </button>
          <div className="px-2 text-muted-foreground flex items-center">|</div>
          <button
            onClick={() => {
              setActiveTab("transactions")
              if (transactions.length === 0 && walletAddress && connection) {
                loadTransactions(true) // Show loading on first load
              }
            }}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "transactions"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
          >
            Transactions ({transactions.length})
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4 sm:py-6 min-h-0 scrollbar-hide">
          {loading && isInitialLoad && activeTab !== "transactions" ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Loading positions...
            </div>
          ) : activeTab === "active" ? (
            <ActiveBetsTab
              positions={activePositions}
              markets={markets}
              onPositionClick={(marketPda) => {
                router.push(`/market/${marketPda.toString()}`)
                onClose() // Close modal when navigating
              }}
              onShare={handleShare}
              sharingLoading={sharingLoading}
            />
          ) : activeTab === "history" ? (
            <HistoryTab
              positions={historyPositions}
              markets={markets}
              onClaim={handleClaim}
              claiming={claiming}
              claimError={claimError}
            />
          ) : (
            <TransactionsTab
              transactions={transactions}
              loading={txLoading}
              markets={markets}
              onMarketClick={(marketPda) => {
                router.push(`/market/${marketPda.toString()}`)
                onClose()
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ActiveBetsTab({
  positions,
  markets,
  onPositionClick,
  onShare,
  sharingLoading,
}: {
  positions: PositionData[]
  markets: Map<string, any>
  onPositionClick: (marketPda: PublicKey) => void
  onShare: (data: PnLData, positionId: string) => void
  sharingLoading: string | null
}) {
  if (positions.length === 0) {
    return (
      <div className="text-center py-8 sm:py-12 text-muted-foreground">
        <p className="text-xs sm:text-sm">No active positions.</p>
        <p className="text-xs mt-1">Place a bet to get started!</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 sm:space-y-3">
      {positions.map((position) => {
        const market = markets.get(position.marketPda.toString())
        const amountSol = Number(position.amount) / LAMPORTS_PER_SOL

        // Calculate unrealized P&L, probability, and potential payout for active positions
        let currentValue = amountSol
        let pnl = 0
        let pnlPercent = 0
        let probability = 50
        let potentialPayout = amountSol

        if (market) {
          const yesPoolSol = Number(market.yesPool) / LAMPORTS_PER_SOL
          const noPoolSol = Number(market.noPool) / LAMPORTS_PER_SOL
          const totalPool = yesPoolSol + noPoolSol
          const yourPool = position.outcome ? yesPoolSol : noPoolSol
          const otherPool = position.outcome ? noPoolSol : yesPoolSol

          // Calculate probability
          if (totalPool > 0) {
            probability = position.outcome
              ? (yesPoolSol / totalPool) * 100
              : (noPoolSol / totalPool) * 100
          }

          if (yourPool > 0 && otherPool > 0) {
            // Current value = what you'd get if market resolved now
            const shareOfOther = (amountSol * otherPool) / yourPool
            currentValue = amountSol + shareOfOther
            potentialPayout = currentValue
            pnl = currentValue - amountSol
            pnlPercent = amountSol > 0 ? (pnl / amountSol) * 100 : 0
          }
        }

        // Format resolve date
        const resolveDate = market?.endTimestamp
          ? new Date(Number(market.endTimestamp) * 1000)
          : null
        const formatDate = (date: Date) => {
          return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined
          })
        }

        return (
          <div
            key={position.positionPda.toString()}
            className="border border-border rounded-lg p-3 sm:p-4 hover:bg-background/50 transition-all cursor-pointer transform-gpu will-change-transform active:scale-[0.98]"
            onClick={() => onPositionClick(position.marketPda)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span
                    className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:py-1 rounded flex-shrink-0 transition-all ${position.outcome
                      ? "bg-neon-green/10 neon-text-green neon-border-green border"
                      : "bg-neon-magenta/10 neon-text-magenta neon-border-magenta border"
                      }`}
                  >
                    {position.outcome ? "YES" : "NO"}
                  </span>
                  <span className="text-xs sm:text-sm font-semibold flex items-center gap-1 flex-shrink-0">
                    <SolanaLogo size={12} />
                    {amountSol.toFixed(4)} SOL
                  </span>
                  {pnl !== 0 && (
                    <span className={`text-[10px] sm:text-xs font-bold flex items-center gap-1 ${pnl > 0 ? "neon-text-green" : "neon-text-magenta"
                      }`}>
                      {pnl > 0 ? "+" : ""}{pnl.toFixed(4)} SOL ({pnlPercent > 0 ? "+" : ""}{pnlPercent.toFixed(1)}%)
                    </span>
                  )}
                </div>
                {market && (
                  <div className="text-xs sm:text-sm text-[#E5E5E5] font-medium mb-1 truncate">
                    {(() => {
                      const ticker = (market as any)?.ticker
                      const tokenMintStr = market?.tokenMint?.toString() || ""
                      const tokenDisplay = ticker || (tokenMintStr ? `${tokenMintStr.slice(0, 4)}...${tokenMintStr.slice(-4)}` : "Token")
                      return `Will ${tokenDisplay} hit $${formatMarketCapShort(Number(market.targetMarketCap))}?`
                    })()}
                  </div>
                )}
                {market ? (
                  <>
                    <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-muted-foreground">
                      <span>Probability: {probability.toFixed(1)}%</span>
                      <span>•</span>
                      <span>Potential: {potentialPayout.toFixed(4)} SOL</span>
                      {resolveDate && (
                        <>
                          <span>•</span>
                          <span>Resolves: {formatDate(resolveDate)}</span>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground font-mono truncate">
                    Market: {formatAddress(position.marketPda)}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    const pdaStr = position.positionPda.toString()
                    const ticker = (market as any)?.ticker
                    const tokenMintStr = market?.tokenMint?.toString() || ""
                    const tokenDisplay = ticker || (tokenMintStr ? `${tokenMintStr.slice(0, 4)}...${tokenMintStr.slice(-4)}` : "Token")
                    const question = `Will ${tokenDisplay} hit $${formatMarketCapShort(Number(market?.targetMarketCap || 0))}?`

                    onShare({
                      marketQuestion: question,
                      side: position.outcome ? "YES" : "NO",
                      amount: amountSol,
                      pnl: pnl,
                      pnlPercent: pnlPercent,
                      currentValue: currentValue,
                      tokenMint: market?.tokenMint?.toString()
                    }, pdaStr)
                  }}
                  disabled={sharingLoading === position.positionPda.toString()}
                  className="text-xs flex-shrink-0 h-8 w-8 p-0 hover:neon-text-cyan hover:bg-neon-cyan/10 transition-all"
                  title="Share PnL"
                >
                  <Share2 className={`h-3.5 w-3.5 ${sharingLoading === position.positionPda.toString() ? "animate-pulse" : ""}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation() // Prevent card click when clicking external link
                    window.open(
                      `https://solscan.io/account/${position.marketPda.toString()}?cluster=devnet`,
                      "_blank"
                    )
                  }}
                  className="text-xs flex-shrink-0 h-8 w-8 p-0 hover:neon-text-green hover:bg-neon-green/10 transition-all"
                  title="View on Solscan"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )
      })}
    </div >
  )
}

function HistoryTab({
  positions,
  markets,
  onClaim,
  claiming,
  claimError,
}: {
  positions: PositionData[]
  markets: Map<string, any>
  onClaim: (position: PositionData, marketPda: PublicKey) => void
  claiming: string | null
  claimError: string | null
}) {
  if (positions.length === 0) {
    return (
      <div className="text-center py-8 sm:py-12 text-muted-foreground">
        <p className="text-xs sm:text-sm">No bet history yet.</p>
        <p className="text-xs mt-1">Resolved or closed positions will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 sm:space-y-3">
      {positions.map((position) => {
        const market = markets.get(position.marketPda.toString())
        const amountSol = Number(position.amount) / LAMPORTS_PER_SOL

        if (!market) {
          return (
            <div
              key={position.positionPda.toString()}
              className="border border-border rounded-lg p-3 sm:p-4 text-xs sm:text-sm text-muted-foreground"
            >
              Market data unavailable
            </div>
          )
        }

        // Determine if user won (only if market is resolved)
        const isResolved = market.resolved
        const userWon = isResolved && market.outcome !== null ? market.outcome === position.outcome : null
        const outcome = market.outcome !== null ? (market.outcome ? "YES" : "NO") : null

        // Check if position was sold out (zero amount)
        const isSoldOut = amountSol === 0

        // Calculate realized P&L for history positions
        let pnl = 0
        let pnlPercent = 0
        let pnlLabel = ""

        if (isResolved && outcome !== null) {
          if (userWon) {
            // Calculate payout: amount + (amount * losing_pool / winning_pool)
            const yesPoolSol = Number(market.yesPool) / LAMPORTS_PER_SOL
            const noPoolSol = Number(market.noPool) / LAMPORTS_PER_SOL
            const winningPool = position.outcome ? yesPoolSol : noPoolSol
            const losingPool = position.outcome ? noPoolSol : yesPoolSol

            if (winningPool > 0 && losingPool > 0) {
              const shareOfLosingPool = (amountSol * losingPool) / winningPool
              const payout = amountSol + shareOfLosingPool
              pnl = payout - amountSol
              pnlPercent = amountSol > 0 ? (pnl / amountSol) * 100 : 0
              pnlLabel = "Profit"
            }
          } else {
            // Lost: P&L = -amount (lost everything)
            pnl = -amountSol
            pnlPercent = -100
            pnlLabel = "Loss"
          }
        } else if (isSoldOut && !isResolved) {
          // Sold out before resolution - approximate P&L (we don't have exact sell price)
          // This is an estimate based on typical sell formula
          pnlLabel = "Sold"
          // We can't calculate exact P&L without transaction data, so show as "Sold"
        }

        // Format resolution date
        const resolutionDate = market.endTimestamp
          ? new Date(Number(market.endTimestamp) * 1000)
          : null
        const formatDate = (date: Date) => {
          return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined
          })
        }

        return (
          <div
            key={position.positionPda.toString()}
            className="border border-border rounded-lg p-3 sm:p-4 hover:bg-background/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 sm:py-1 rounded flex-shrink-0 ${position.outcome
                      ? "bg-green-500/20 text-green-500"
                      : "bg-red-500/20 text-red-500"
                      }`}
                  >
                    {position.outcome ? "YES" : "NO"}
                  </span>
                  {!isSoldOut && (
                    <span className="text-xs sm:text-sm font-semibold flex items-center gap-1 flex-shrink-0">
                      <SolanaLogo size={12} />
                      {amountSol.toFixed(4)} SOL
                    </span>
                  )}
                  {isSoldOut && (
                    <span className="text-xs text-muted-foreground">Sold Out</span>
                  )}
                  {pnl !== 0 && (
                    <span className={`text-xs font-medium flex items-center gap-1 ${pnl > 0 ? "text-green-500" : "text-red-500"
                      }`}>
                      {pnl > 0 ? "+" : ""}{pnl.toFixed(4)} SOL ({pnlPercent > 0 ? "+" : ""}{pnlPercent.toFixed(1)}%)
                    </span>
                  )}
                  {isSoldOut && !isResolved && (
                    <span className="text-xs text-muted-foreground">• {pnlLabel}</span>
                  )}
                </div>
                <div className="text-xs sm:text-sm text-foreground mb-1 truncate">
                  {(() => {
                    const ticker = (market as any)?.ticker
                    const tokenMintStr = market?.tokenMint?.toString() || ""
                    const tokenDisplay = ticker || (tokenMintStr ? `${tokenMintStr.slice(0, 4)}...${tokenMintStr.slice(-4)}` : "Token")
                    return `Will ${tokenDisplay} hit $${formatMarketCapShort(Number(market.targetMarketCap))}?`
                  })()}
                </div>
                {isResolved && outcome !== null && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span
                      className={`text-xs font-medium ${userWon ? "text-green-500" : "text-red-500"
                        }`}
                    >
                      Outcome: {outcome} • {userWon ? "WON" : "LOST"}
                    </span>
                    {pnl !== 0 && (
                      <span className={`text-xs font-medium ${pnl > 0 ? "text-green-500" : "text-red-500"
                        }`}>
                        • {pnlLabel}: {pnl > 0 ? "+" : ""}{pnl.toFixed(4)} SOL ({pnlPercent > 0 ? "+" : ""}{pnlPercent.toFixed(1)}%)
                      </span>
                    )}
                    {position.claimed && (
                      <span className="text-xs text-muted-foreground">• Claimed</span>
                    )}
                  </div>
                )}
                {!isResolved && isSoldOut && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Position closed (pre-resolution sell)
                  </div>
                )}
                {resolutionDate && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Resolved: {formatDate(resolutionDate)}
                  </div>
                )}
                {isResolved && userWon && !position.claimed && !isSoldOut && (
                  <div className="mt-3">
                    {claimError && claiming === position.positionPda.toString() && (
                      <div className="text-xs text-red-500 mb-2">{claimError}</div>
                    )}
                    <Button
                      size="sm"
                      onClick={() => onClaim(position, position.marketPda)}
                      disabled={claiming === position.positionPda.toString()}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs h-8 px-3"
                    >
                      {claiming === position.positionPda.toString() ? "Claiming..." : "Claim Winnings"}
                    </Button>
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  window.open(
                    `https://solscan.io/account/${position.marketPda.toString()}?cluster=devnet`,
                    "_blank"
                  )
                }}
                className="text-xs flex-shrink-0 h-8 w-8 p-0"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}


function TransactionsTab({
  transactions,
  loading,
  markets,
  onMarketClick,
}: {
  transactions: TransactionData[]
  loading: boolean
  markets: Map<string, any>
  onMarketClick: (marketPda: PublicKey) => void
}) {
  const router = useRouter()
  const formatDate = (blockTime: number | null) => {
    if (!blockTime) return "Unknown"
    const date = new Date(blockTime * 1000)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined })
  }

  const getTransactionType = (signature: string, err: any) => {
    if (err) return { label: "Failed", color: "text-red-500", bgColor: "bg-red-500/10", icon: ArrowDownRight }
    return { label: "Transaction", color: "text-green-500", bgColor: "bg-green-500/10", icon: ArrowUpRight }
  }

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Loading transactions...
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 sm:py-12 text-muted-foreground">
        <p className="text-xs sm:text-sm">No transactions yet.</p>
        <p className="text-xs mt-1">Your transaction history will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 sm:space-y-3">
      {transactions.map((tx) => {
        const txType = getTransactionType(tx.signature, tx.err)
        const Icon = txType.icon
        const market = tx.marketPda ? markets.get(tx.marketPda) : null

        return (
          <div
            key={tx.signature}
            className="border border-border rounded-lg p-3 sm:p-4 hover:bg-background/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded flex-shrink-0 ${txType.bgColor} ${txType.color}`}>
                    {txType.label}
                  </span>
                  {tx.amount !== undefined && (
                    <span className="text-xs sm:text-sm font-semibold flex items-center gap-1 flex-shrink-0">
                      <SolanaLogo size={12} />
                      {tx.amount.toFixed(4)} SOL
                    </span>
                  )}
                  {tx.outcome !== undefined && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${tx.outcome ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                      }`}>
                      {tx.outcome ? "YES" : "NO"}
                    </span>
                  )}
                  {tx.fee !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      Fee: {tx.fee} SOL
                    </span>
                  )}
                  {tx.err && (
                    <span className="text-xs text-red-500 bg-red-500/10 px-2 py-0.5 rounded">
                      Error
                    </span>
                  )}
                </div>
                {market && (
                  <div
                    className="text-xs sm:text-sm text-foreground mb-1 truncate cursor-pointer hover:underline"
                    onClick={() => {
                      onMarketClick(new PublicKey(tx.marketPda!))
                    }}
                  >
                    Market: {formatAddress(tx.marketPda!)}
                  </div>
                )}
                <div className="text-xs text-muted-foreground font-mono truncate mb-1">
                  {tx.signature.slice(0, 8)}...{tx.signature.slice(-8)}
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-muted-foreground">
                  <span>{formatDate(tx.blockTime)}</span>
                  <span>•</span>
                  <span className={tx.err ? "text-red-500" : "text-green-500"}>
                    {tx.err ? "Failed" : "Confirmed"}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  window.open(
                    `https://solscan.io/tx/${tx.signature}?cluster=devnet`,
                    "_blank"
                  )
                }}
                className="text-xs flex-shrink-0 h-8 w-8 p-0"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
