"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useWallet } from "./wallet-provider"
import { fetchMarketByPdaFrontend } from "@/lib/market-frontend"
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js"
import { MarketCard } from "@/components/market-card"
import * as anchor from "@coral-xyz/anchor"
import bs58 from "bs58"

// No hardcoded seeded markets - all markets come from user creation or API
export const SEEDED_MARKETS: { pda: string; ticker: string; category: string }[] = []

// Helper function to validate if a string is a valid base58-encoded Solana address
function isValidSolanaAddress(address: string): boolean {
  try {
    // Check if it's a valid base58 string and decodes to exactly 32 bytes
    const decoded = bs58.decode(address)
    return decoded.length === 32
  } catch (error) {
    // Invalid base58 or wrong length
    return false
  }
}

// Helper to get all markets from API and localStorage
async function getAllMarkets(): Promise<{ pda: string; ticker: string; category: string }[]> {
  const allMarkets: { pda: string; ticker: string; category: string }[] = []

  try {
    // First, fetch markets from the database API
    console.log("Fetching markets from API...")
    const response = await fetch(window.location.origin + '/api/markets')
    console.log("API response status:", response.status)
    if (response.ok) {
      const dbMarkets = await response.json()
      console.log("Markets from API:", dbMarkets.length, dbMarkets)
      for (const market of dbMarkets) {
        // Validate PDA before adding
        if (market.pda && isValidSolanaAddress(market.pda)) {
          allMarkets.push({
            pda: market.pda,
            ticker: market.tokenSymbol || 'UNKNOWN',
            category: 'new' // All markets from DB are categorized as 'new'
          })
        } else {
          console.warn("Skipping invalid PDA from API:", market.pda)
        }
      }
    } else {
      console.error("API response not ok:", response.status)
    }
  } catch (e) {
    console.error("Failed to fetch markets from API:", e)
  }

  // Also include any user-created markets from localStorage (for fallback/new markets)
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('created_markets')
      if (stored) {
        const createdMarkets = JSON.parse(stored)
        // Add local markets that aren't already in the API results
        for (const m of createdMarkets) {
          if (!allMarkets.find(existing => existing.pda === m.pda)) {
            // Validate PDA before adding
            if (m.pda && isValidSolanaAddress(m.pda)) {
            allMarkets.push({ pda: m.pda, ticker: m.ticker, category: m.category || 'new' })
            } else {
              console.warn("Skipping invalid PDA from localStorage:", m.pda)
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to load created markets:", e)
    }
  }

  return allMarkets
}

interface MarketFeedProps {
  searchQuery: string
  categoryFilter: string | null
}

export function MarketFeed({ searchQuery, categoryFilter }: MarketFeedProps) {
  const [markets, setMarkets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { connection } = useWallet()

  const fetchMarkets = useCallback(async () => {
    if (!connection) {
      setLoading(false)
      return
    }

    console.log("Starting fetchMarkets...")
    console.log("RPC Endpoint:", connection?.rpcEndpoint)

    // Prevent overlapping fetches could be handled with a ref, but for now just rely on the interval
    try {
      const allMarketsList = await getAllMarkets()
      console.log("All markets list:", allMarketsList.length, allMarketsList)
      // Create a map for faster lookups
      const marketMap = new Map(allMarketsList.map(m => [m.pda, m]))

      const marketData = await Promise.all(
        allMarketsList.map(async ({ pda, ticker }) => {
          try {
            // Additional validation (should already be validated upstream)
            if (!isValidSolanaAddress(pda)) {
              console.warn("Skipping invalid PDA in fetchMarkets:", pda)
              return null
            }

            const marketPda = new PublicKey(pda)
            const market = await fetchMarketByPdaFrontend(connection, marketPda)
            if (market) {
              return {
                pda: marketPda.toString(),
                tokenMint: market.tokenMint.toString(),
                targetMarketCap: market.targetMarketCap,
                endTimestamp: market.endTimestamp,
                resolved: market.resolved,
                yesPool: market.yesPool,
                noPool: market.noPool,
                outcome: market.outcome,
                ticker,
                category: marketMap.get(marketPda.toString())?.category || 'new',
              }
            }
          } catch (error) {
            console.error(`Failed to fetch market ${pda}:`, error)
            // Continue with other markets - don't let one failure stop the whole process
          }
          return null
        })
      )

      const filteredMarkets = marketData.filter(m => m !== null)
      console.log("Final markets to display:", filteredMarkets.length, filteredMarkets)
      setMarkets(filteredMarkets)
      setLoading(false)
    } catch (error) {
      console.error("Failed to fetch markets:", error)
      setLoading(false)
    }
  }, [connection])

  useEffect(() => {
    if (!connection) {
      setLoading(false)
      return
    }

    // Initial fetch
    fetchMarkets()

    // Poll every 10 seconds to reduce load
    const interval = setInterval(fetchMarkets, 30000)

    return () => clearInterval(interval)
  }, [connection, fetchMarkets])

  // Filter markets based on category and search query
  const filteredMarkets = useMemo(() => {
    let filtered = markets.filter((market) => {
      // Search filter: check if search query matches token mint (first 4 and last 4 chars)
      if (searchQuery.trim()) {
        const tokenMintStr = market.tokenMint.toString()
        const searchLower = searchQuery.toLowerCase().trim()
        const tokenDisplay = `${tokenMintStr.slice(0, 4)}...${tokenMintStr.slice(-4)}`

        if (!tokenDisplay.toLowerCase().includes(searchLower) &&
          !tokenMintStr.toLowerCase().includes(searchLower)) {
          return false
        }
      }

      // Category filter logic:
      // - New: Fresh markets (user-created, low activity, or non-seeded)
      // - Hot: High activity markets (>0.5 SOL in pools)
      // - Trenches: All markets with new ones prioritized
      if (categoryFilter === "hot") {
        // Hot = markets with significant pool activity (> 0.5 SOL total)
        const totalPool = Number(market.yesPool) + Number(market.noPool)
        const totalPoolSol = totalPool / LAMPORTS_PER_SOL
        return totalPoolSol > 0.5 && !market.resolved
      } else if (categoryFilter === "new") {
        // New = fresh markets based on time (user-created markets or recent activity)
        const totalPool = Number(market.yesPool) + Number(market.noPool)
        const totalPoolSol = totalPool / LAMPORTS_PER_SOL

        // Consider "new" if: user-created (has createdAt), very low activity, or not in seeded markets
        const isUserCreated = market.createdAt && market.createdAt > 0
        const isVeryLowActivity = totalPoolSol < 0.1
        const isNotSeeded = !SEEDED_MARKETS.find(m => m.pda === market.pda)

        return (isUserCreated || isVeryLowActivity || isNotSeeded) && !market.resolved
      } else if (categoryFilter === "trenches") {
        // Trenches = all markets (both new and old) but new ones first (sorting handled below)
        return true
      } else if (categoryFilter) {
        // Custom categories: KOLs, Cabals, Whales, AI, etc.
        return market.category === categoryFilter
      }

      // "All" or null: show all markets
      return true
    })

    // Special sorting for trenches: new markets first
    if (categoryFilter === "trenches") {
      filtered = filtered.sort((a, b) => {
        // Helper function to determine if market is "new"
        const isNewMarket = (market: any) => {
          const totalPool = Number(market.yesPool) + Number(market.noPool)
          const totalPoolSol = totalPool / LAMPORTS_PER_SOL
          const isUserCreated = market.createdAt && market.createdAt > 0
          const isVeryLowActivity = totalPoolSol < 0.1
          const isNotSeeded = !SEEDED_MARKETS.find(m => m.pda === market.pda)
          return isUserCreated || isVeryLowActivity || isNotSeeded
        }

        const aIsNew = isNewMarket(a)
        const bIsNew = isNewMarket(b)

        // New markets first
        if (aIsNew && !bIsNew) return -1
        if (!aIsNew && bIsNew) return 1

        // Both new or both old: sort by creation time (newest first)
        const aCreatedTime = a.createdAt || 0
        const bCreatedTime = b.createdAt || 0
        return bCreatedTime - aCreatedTime
      })
    }

    return filtered
  }, [markets, searchQuery, categoryFilter])

  const handleBetPlaced = async () => {
    // Immediate refresh after bet is placed (polling will continue)
    if (connection) {
      await fetchMarkets()
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="text-6xl animate-pulse">👾</div>
        <p className="text-muted-foreground">Loading markets from chain...</p>
      </div>
    )
  }

  if (filteredMarkets.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">
          {searchQuery.trim() || categoryFilter
            ? "No markets match your filters"
            : "No markets found"}
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {filteredMarkets.map((market) => (
        <div key={market.pda} className="market-card-container">
          <MarketCard
            pda={market.pda}
            tokenMint={market.tokenMint}
            targetMarketCap={market.targetMarketCap}
            endTimestamp={market.endTimestamp}
            resolved={market.resolved}
            yesPool={market.yesPool}
            noPool={market.noPool}
            outcome={market.outcome}
            ticker={market.ticker}
            category={market.category}
            onBetPlaced={handleBetPlaced}
          />
        </div>
      ))}
    </div>
  )
}
