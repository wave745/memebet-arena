"use client"

import { TopBar } from "@/components/top-bar"
import dynamic from "next/dynamic"

// Lazy load heavy components for better initial performance
const MarketFeed = dynamic(() => import("@/components/market-feed").then(mod => ({ default: mod.MarketFeed })), {
  loading: () => <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-green"></div></div>
})
const ActivityFeed = dynamic(() => import("@/components/activity-feed").then(mod => ({ default: mod.ActivityFeed })), {
  loading: () => <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-green"></div></div>
})
const LeaderboardFeed = dynamic(() => import("@/components/leaderboard-feed").then(mod => ({ default: mod.LeaderboardFeed })), {
  loading: () => <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-green"></div></div>
})
const SearchModal = dynamic(() => import("@/components/search-modal").then(mod => ({ default: mod.SearchModal })))
const WalletModal = dynamic(() => import("@/components/wallet-modal").then(mod => ({ default: mod.WalletModal })))
import { WalletProvider, useWallet } from "@/components/wallet-provider"
import { ErrorBoundary } from "@/components/error-boundary"
import { useState, useEffect } from "react"

function HomeContent() {
  const { walletConnected, walletAddress, solBalance, connect, disconnect } = useWallet()
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)

  useEffect(() => {
    // Check URL params for category on mount
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const category = params.get('category')
      if (category) {
        setCategoryFilter(category)
      }
    }

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "/" && !isSearchModalOpen) {
        e.preventDefault()
        setIsSearchModalOpen(true)
      }
    }

    document.addEventListener("keydown", handleKeyPress)
    return () => document.removeEventListener("keydown", handleKeyPress)
  }, [isSearchModalOpen])

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
        onSearchModalOpen={() => setIsSearchModalOpen(true)}
      />
      <main className="mx-auto max-w-7xl px-3 sm:px-4 pt-[110px] sm:pt-[136px] pb-8">
        {categoryFilter === 'live' ? (
          <ActivityFeed />
        ) : categoryFilter === 'leaderboard' ? (
          <LeaderboardFeed />
        ) : (
          <MarketFeed searchQuery={searchQuery} categoryFilter={categoryFilter} />
        )}
      </main>

      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onCategorySelect={setCategoryFilter}
      />

      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
      />
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <WalletProvider>
        <HomeContent />
      </WalletProvider>
    </ErrorBoundary>
  )
}