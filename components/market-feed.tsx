"use client"

import { useEffect } from "react"
import { useState } from "react"
import { useWallet } from "./wallet-provider"
import { fetchMarketByPda } from "@/lib/anchor/markets"
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js"
import { MarketCard } from "@/components/market-card"
import * as anchor from "@coral-xyz/anchor"

// Hardcoded seeded market PDAs (until indexer exists)
const SEEDED_MARKET_PDAS = [
  "7PtZBSzh8LN9oeQMi3uUhQRaQ7yBDs4skWcZMtGmVhcc", // BONK $5B
  "ERwWqoCH2NDuT25eeG8uGruVGH9qpFX6bU47SUBgJ11E", // WIF $10B
  "7SiMKeNgReui2NdMgodxGCogRumYf2Bob4NfuhVrC84h", // POPCAT $2B
  "2jvKsrAkRbTqXiffcerA7sWhau3SDYCnoec2BtNiQDRE", // BONK $3B
  "5mwSAmNfF6ddY4KHmVN9DwgxaFbPEUuxpBxJfu2hnH3a", // WIF $8B
]

interface MarketFeedProps {
  searchQuery: string
  categoryFilter: "hot" | "new" | null
}

export function MarketFeed({ searchQuery, categoryFilter }: MarketFeedProps) {
  const [markets, setMarkets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { connection } = useWallet()

  const fetchMarkets = async () => {
    if (!connection) {
      console.log("No connection available")
      setLoading(false)
      return
    }

    console.log("Fetching markets from chain...")
    const marketData = []
    for (const pdaStr of SEEDED_MARKET_PDAS) {
      try {
        const marketPda = new PublicKey(pdaStr)
        // Pass null for wallet - read-only operation
        const market = await fetchMarketByPda(connection, null, marketPda)
        if (market) {
          marketData.push({
            pda: marketPda.toString(),
            tokenMint: market.tokenMint.toString(),
            targetMarketCap: market.targetMarketCap,
            endTimestamp: market.endTimestamp,
            resolved: market.resolved,
            yesPool: market.yesPool,
            noPool: market.noPool,
            outcome: market.outcome,
          })
        }
      } catch (error) {
        console.error(`Failed to fetch market ${pdaStr}:`, error)
      }
    }

    setMarkets(marketData)
    setLoading(false)
  }

  useEffect(() => {
    // Initial fetch
    if (connection) {
      fetchMarkets()
    } else {
      setLoading(false)
    }
  }, [connection])

  // Real-time polling every 5 seconds
  useEffect(() => {
    if (!connection) return

    const interval = setInterval(() => {
      fetchMarkets()
    }, 5000) // Poll every 5 seconds

    return () => clearInterval(interval)
  }, [connection])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="text-6xl animate-pulse">👾</div>
        <p className="text-muted-foreground">Loading markets from chain...</p>
      </div>
    )
  }

  const handleBetPlaced = async () => {
    // Immediate refresh after bet is placed (polling will continue)
    if (connection) {
      await fetchMarkets()
    }
  }

  // Filter markets based on category and search query
  const filteredMarkets = markets.filter((market) => {
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

    // Category filter
    if (categoryFilter === "hot") {
      // Hot: Markets with high total pool (high trading activity)
      // Consider a market "hot" if total pool > 1 SOL
      const totalPool = Number(market.yesPool) + Number(market.noPool)
      const totalPoolSol = totalPool / LAMPORTS_PER_SOL
      return totalPoolSol > 1 && !market.resolved
    } else if (categoryFilter === "new") {
      // New: Markets created recently (within last 7 days)
      const now = Date.now() / 1000
      const marketEndTime = Number(market.endTimestamp)
      const daysUntilEnd = (marketEndTime - now) / (24 * 60 * 60)
      // Consider "new" if market ends in more than 7 days (recently created)
      return daysUntilEnd > 7 && !market.resolved
    }
    
    // "All" or null: show all markets
    return true
  })

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
        <MarketCard
          key={market.pda}
          pda={market.pda}
          tokenMint={market.tokenMint}
          targetMarketCap={market.targetMarketCap}
          endTimestamp={market.endTimestamp}
          resolved={market.resolved}
          yesPool={market.yesPool}
          noPool={market.noPool}
          outcome={market.outcome}
          onBetPlaced={handleBetPlaced}
        />
      ))}
    </div>
  )
}
