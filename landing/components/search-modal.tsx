"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, TrendingUp, Sparkles, ArrowRight, Zap } from "lucide-react"
import { useWallet } from "./wallet-provider"
import { fetchMarketByPdaFrontend } from "@/lib/market-frontend"
import { PublicKey } from "@solana/web3.js"
import { useRouter } from "next/navigation"
import { XLogo } from "./x-logo"
import { formatMarketCapShort } from "@/lib/utils/format-market-cap"

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
  searchQuery: string
  onSearchChange: (query: string) => void
  onCategorySelect: (category: string | null) => void
}

const BROWSE_CATEGORIES = [
  { label: "New", icon: Sparkles, value: "new" },
  { label: "Hot", icon: TrendingUp, value: "hot" },
  { label: "Trenches", icon: Zap, value: "trenches" },
  { label: "KOLs", icon: XLogo, value: "kols", comingSoon: true },
]

// Hardcoded seeded market PDAs (same as market-feed.tsx)
const SEEDED_MARKET_PDAS = [
  "7PtZBSzh8LN9oeQMi3uUhQRaQ7yBDs4skWcZMtGmVhcc", // BONK $5B
  "ERwWqoCH2NDuT25eeG8uGruVGH9qpFX6bU47SUBgJ11E", // WIF $10B
  "7SiMKeNgReui2NdMgodxGCogRumYf2Bob4NfuhVrC84h", // POPCAT $2B
  "2jvKsrAkRbTqXiffcerA7sWhau3SDYCnoec2BtNiQDRE", // BONK $3B
  "5mwSAmNfF6ddY4KHmVN9DwgxaFbPEUuxpBxJfu2hnH3a", // WIF $8B
]

interface MarketResult {
  pda: string
  tokenMint: string
  targetMarketCap: bigint
  resolved: boolean
  yesPool: bigint
  noPool: bigint
}

export function SearchModal({ isOpen, onClose, searchQuery, onSearchChange, onCategorySelect }: SearchModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { connection } = useWallet()
  const [markets, setMarkets] = useState<MarketResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)

  // Fetch markets when modal opens
  useEffect(() => {
    if (isOpen && connection) {
      fetchMarkets()
    }
  }, [isOpen, connection])

  const fetchMarkets = async () => {
    if (!connection) return

    setLoading(true)
    try {
      const marketData: MarketResult[] = []
      for (const pdaStr of SEEDED_MARKET_PDAS) {
        try {
          const marketPda = new PublicKey(pdaStr)
          const market = await fetchMarketByPdaFrontend(connection, marketPda)
          if (market) {
            marketData.push({
              pda: marketPda.toString(),
              tokenMint: market.tokenMint.toString(),
              targetMarketCap: market.targetMarketCap,
              resolved: market.resolved,
              yesPool: market.yesPool,
              noPool: market.noPool,
            })
          }
        } catch (error) {
          console.error(`Failed to fetch market ${pdaStr}:`, error)
        }
      }
      setMarkets(marketData)
    } catch (error) {
      console.error("Failed to fetch markets:", error)
    } finally {
      setLoading(false)
    }
  }

  // Filter markets based on search query
  const filteredMarkets = useMemo(() => {
    if (!searchQuery.trim()) return []

    const query = searchQuery.toLowerCase().trim()
    return markets.filter((market) => {
      const tokenMintStr = market.tokenMint.toLowerCase()
      const tokenDisplay = `${tokenMintStr.slice(0, 4)}...${tokenMintStr.slice(-4)}`
      const targetCap = formatMarketCapShort(Number(market.targetMarketCap))
      const targetCapStr = targetCap.toString()

      return (
        tokenMintStr.includes(query) ||
        tokenDisplay.includes(query) ||
        targetCapStr.includes(query)
      )
    })
  }, [markets, searchQuery])

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      setSelectedIndex(0)
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, filteredMarkets.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === "Enter" && filteredMarkets.length > 0) {
        e.preventDefault()
        handleMarketSelect(filteredMarkets[selectedIndex])
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      document.addEventListener("keydown", handleKeyDown)
      return () => {
        document.removeEventListener("keydown", handleEscape)
        document.removeEventListener("keydown", handleKeyDown)
      }
    }
  }, [isOpen, onClose, filteredMarkets, selectedIndex])

  const handleMarketSelect = (market: MarketResult) => {
    router.push(`/market/${market.pda}`)
    onClose()
  }

  if (!isOpen) return null

  const handleCategoryClick = (value: string | null) => {
    onCategorySelect(value)
    onClose()
  }

  const formatTokenDisplay = (tokenMint: string) => {
    return `${tokenMint.slice(0, 4)}...${tokenMint.slice(-4)}`
  }

  const formatMarketCap = (targetMarketCap: bigint) => {
    return formatMarketCapShort(Number(targetMarketCap))
  }

  return (
    <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="fixed left-1/2 top-16 w-full max-w-2xl -translate-x-1/2 rounded-lg border border-border bg-card shadow-2xl max-h-[80vh] flex flex-col shining-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 flex-shrink-0">
          <Search className="h-5 w-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search markets by token or market cap..."
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value)
              setSelectedIndex(0)
            }}
            className="h-auto border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
          />
        </div>

        {/* Search Results */}
        <div className="flex-1 overflow-y-auto min-h-0 scrollbar-hide">
          {loading ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Loading markets...
            </div>
          ) : searchQuery.trim() ? (
            filteredMarkets.length > 0 ? (
              <div className="py-2">
                {filteredMarkets.map((market, index) => (
                  <button
                    key={market.pda}
                    onClick={() => handleMarketSelect(market)}
                    className={`w-full px-5 py-3 text-left hover:bg-accent/50 transition-colors flex items-center justify-between ${index === selectedIndex ? "bg-accent/30" : ""
                      }`}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-medium text-sm text-foreground">
                          {formatTokenDisplay(market.tokenMint)}
                        </div>
                        {market.resolved && (
                          <div className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            Resolved
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Target: {formatMarketCap(market.targetMarketCap)}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No markets found matching "{searchQuery}"
              </div>
            )
          ) : (
            <div className="px-5 py-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Browse</h3>
              <div className="flex flex-wrap gap-2">
                {BROWSE_CATEGORIES.map((category) => (
                  <Button
                    key={category.label}
                    variant="outline"
                    size="sm"
                    onClick={() => !category.comingSoon && handleCategoryClick(category.value)}
                    className={`h-9 gap-2 bg-background/50 hover:bg-accent ${category.comingSoon ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <category.icon className="h-4 w-4" />
                    {category.label}
                    {category.comingSoon && (
                      <span className="px-1 py-0.5 rounded-sm bg-neon-green/10 text-[8px] text-neon-green uppercase tracking-tighter border border-neon-green/20">Soon</span>
                    )}
                  </Button>
                ))}
              </div>
              {markets.length > 0 && (
                <>
                  <h3 className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    All Markets
                  </h3>
                  <div className="space-y-1">
                    {markets.slice(0, 5).map((market) => (
                      <button
                        key={market.pda}
                        onClick={() => handleMarketSelect(market)}
                        className="w-full px-3 py-2 text-left hover:bg-accent/50 transition-colors rounded text-sm flex items-center justify-between"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground">
                            {formatTokenDisplay(market.tokenMint)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatMarketCap(market.targetMarketCap)}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer hint */}
        {searchQuery.trim() && filteredMarkets.length > 0 && (
          <div className="px-5 py-2 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
            <span>Use ↑↓ to navigate, Enter to select</span>
            <span>{filteredMarkets.length} result{filteredMarkets.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </div>
  )
}
