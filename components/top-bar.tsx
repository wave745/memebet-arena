"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import Link from "next/link"
import { SolanaLogo } from "./solana-logo"

interface TopBarProps {
  walletConnected: boolean
  walletAddress: string | null
  solBalance: number
  onConnect: () => void
  onDisconnect: () => void
  onWalletClick?: () => void
  searchQuery: string
  onSearchChange: (query: string) => void
  categoryFilter: "hot" | "new" | null
  onCategoryChange: (category: "hot" | "new" | null) => void
  onSearchModalOpen: () => void
}

export function TopBar({
  walletConnected,
  walletAddress,
  solBalance,
  onConnect,
  onDisconnect,
  onWalletClick,
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  onSearchModalOpen,
}: TopBarProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <header className="fixed top-0 left-0 right-0 w-full z-50 glass-header">
      <div className="mx-auto max-w-7xl flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 py-2 sm:py-3">
        {/* Left: Logo */}
        <div className="flex items-baseline gap-2 flex-shrink-0">
          <Link href="/">
            <h1 className="text-lg sm:text-xl font-bold hover:opacity-80 transition-opacity">Trenchmarket</h1>
          </Link>
        </div>

        <div className="flex-1 max-w-md hidden sm:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search markets..."
              value={searchQuery || ""}
              readOnly
              onClick={onSearchModalOpen}
              className="h-9 w-full cursor-pointer pl-9"
            />
          </div>
        </div>

        {/* Mobile: Search Icon */}
        <button
          onClick={onSearchModalOpen}
          className="sm:hidden p-2 hover:bg-accent rounded-md transition-colors"
          aria-label="Search"
        >
          <Search className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Right: Wallet */}
        {mounted && (
          <div className="flex items-center gap-2 sm:gap-4">
            {walletConnected && walletAddress ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={onWalletClick}
                  className="text-right px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-border bg-[#0B0B0D] hover:bg-[#151518] hover:border-border/80 transition-all cursor-pointer"
                >
                  <div className="text-xs sm:text-sm font-mono text-foreground">
                    {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
                  </div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                    <SolanaLogo size={10} gray={false} />
                    {solBalance.toFixed(2)}
                  </div>
                </button>
                <Button variant="outline" size="sm" onClick={onDisconnect} className="text-xs bg-transparent hidden sm:inline-flex">
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button onClick={onConnect} size="sm" className="text-xs sm:text-sm">
                Connect
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 py-1.5 sm:py-2">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <Button
              variant={categoryFilter === null ? "default" : "outline"}
              size="sm"
              onClick={() => onCategoryChange(null)}
              className="h-8 text-xs flex-shrink-0"
            >
              All
            </Button>
            <Button
              variant={categoryFilter === "hot" ? "default" : "outline"}
              size="sm"
              onClick={() => onCategoryChange("hot")}
              className="h-8 text-xs flex-shrink-0"
            >
              Hot
            </Button>
            <Button
              variant={categoryFilter === "new" ? "default" : "outline"}
              size="sm"
              onClick={() => onCategoryChange("new")}
              className="h-8 text-xs flex-shrink-0"
            >
              New
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
