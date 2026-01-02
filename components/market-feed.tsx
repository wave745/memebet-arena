"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useWallet } from "./wallet-provider"
import { fetchMarketByPda } from "@/lib/anchor/markets"
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js"
import { MarketCard } from "@/components/market-card"
import * as anchor from "@coral-xyz/anchor"

// No hardcoded seeded markets - all markets come from user creation or API

// Helper to get all markets from API and localStorage
async function getAllMarkets(): Promise<{ pda: string; ticker: string; category: string }[]> {
  const allMarkets: { pda: string; ticker: string; category: string }[] = []

  try {
    // First, fetch markets from the database API
    const response = await fetch('/api/markets/sync')
    if (response.ok) {
      const dbMarkets = await response.json()
      for (const market of dbMarkets) {
        allMarkets.push({
          pda: market.pda,
          ticker: market.ticker,
          category: market.category || 'new'
        })
      }
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
            allMarkets.push({ pda: m.pda, ticker: m.ticker, category: m.category || 'new' })
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

    // Prevent overlapping fetches could be handled with a ref, but for now just rely on the interval
    try {
      const allMarketsList = await getAllMarkets()
      // Create a map for faster lookups
      const marketMap = new Map(allMarketsList.map(m => [m.pda, m]))

      const marketData = await Promise.all(
        allMarketsList.map(async ({ pda, ticker }) => {
          try {
            const marketPda = new PublicKey(pda)
            const market = await fetchMarketByPda(connection, null, marketPda)
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
          }
          return null
        })
      )

      setMarkets(marketData.filter(m => m !== null))
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
    return markets.filter((market) => {
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
