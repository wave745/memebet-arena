"use client"

import { useState, useEffect } from "react"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, LayoutGrid, Flame, Sparkles, Zap, Users, TrendingUp, Bot, Activity, Trophy } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { SolanaLogo } from "./solana-logo"
import { XLogo } from "./x-logo"

interface TopBarProps {
    walletConnected: boolean
    walletAddress: string | null
    solBalance: number
    onConnect: () => void
    onDisconnect: () => void
    onWalletClick?: () => void
    searchQuery: string
    onSearchChange: (query: string) => void
    categoryFilter: string | null
    onCategoryChange: (category: string | null) => void
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
    const router = useRouter()
    const [mounted, setMounted] = useState(false)
    const { setVisible } = useWalletModal()
    const [balancePulse, setBalancePulse] = useState(false)
    const [lastBalance, setLastBalance] = useState(solBalance)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (solBalance !== lastBalance) {
            setBalancePulse(true)
            const timer = setTimeout(() => setBalancePulse(false), 800)
            setLastBalance(solBalance)
            return () => clearTimeout(timer)
        }
    }, [solBalance, lastBalance])

    return (
        <header className="fixed top-0 left-0 right-0 w-full z-50 glass-header">
            <div className="mx-auto max-w-7xl flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 py-2 sm:py-3">
                {/* Left: Logo */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <Link href="/app" className="glass-text-wrapper hover:scale-105 transition-transform">
                        <h1 className="text-lg sm:text-xl font-black shining-text tracking-tighter">Trenchmarket</h1>
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
                                    className="text-right px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl backdrop-blur-md bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] hover:border-white/20 transition-all cursor-pointer shadow-lg group relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-tr from-neon-green/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="text-xs sm:text-sm font-black text-foreground/90 tracking-tighter relative z-10">
                                        {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
                                    </div>
                                    <div className={`text-[10px] sm:text-xs flex items-center gap-1 justify-end relative z-10 font-bold shining-text transition-all duration-300 ${balancePulse ? "balance-pulse" : ""}`}>
                                        <SolanaLogo size={10} gray={false} />
                                        {solBalance.toFixed(2)}
                                    </div>
                                </button>
                                <Button variant="outline" size="sm" onClick={onDisconnect} className="text-xs bg-transparent hidden sm:inline-flex">
                                    Disconnect
                                </Button>
                            </div>
                        ) : (
                            <Button onClick={() => setVisible(true)} size="sm" className="text-xs sm:text-sm bg-neon-green text-black hover:bg-neon-green/90 shadow-[0_0_20px_rgba(105,255,148,0.2)] font-black uppercase tracking-tighter">
                                Connect Wallet
                            </Button>
                        )}
                    </div>
                )}
            </div>

            <div className="border-t border-white/5 bg-black/20 backdrop-blur-sm">
                <div className="mx-auto max-w-7xl px-3 sm:px-4">
                    <div className="category-bar flex items-center gap-1 sm:gap-2 overflow-x-auto py-2 relative">
                        {[
                            { id: null, label: "All", icon: LayoutGrid, desc: "Slay the full arena", comingSoon: false },
                            { id: "hot", label: "Hot", icon: Flame, desc: "High-volume trending bets", comingSoon: false },
                            { id: "new", label: "New", icon: Sparkles, desc: "Freshly launched alpha", comingSoon: false },
                            { id: "trenches", label: "Trenches", icon: Zap, desc: "Pure memecoin madness", comingSoon: false },
                            { id: "kols", label: "KOLs", icon: XLogo, desc: "Bet on influencer signals", comingSoon: true },
                            { id: "cabals", label: "Cabals", icon: Users, desc: "Insider & hidden activities", comingSoon: true },
                            { id: "ai", label: "AI", icon: Bot, desc: "Future-forward agentic markets", comingSoon: true },
                            { id: "leaderboard", label: "Leaderboard", icon: Trophy, desc: "Arena Champions", comingSoon: false },
                            { id: "live", label: "Live", icon: Activity, desc: "Real-time arena feed", comingSoon: false },
                        ].map((cat) => (
                            <div key={cat.label} className="relative group/tab">
                                <button
                                    onClick={() => {
                                        if (cat.comingSoon) return

                                        // Always update the filter state
                                        onCategoryChange(cat.id as any)

                                        // Update URL params for the current page
                                        if (typeof window !== 'undefined') {
                                            const url = new URL(window.location.href)
                                            if (cat.id) {
                                                url.searchParams.set('category', cat.id)
                                        } else {
                                                url.searchParams.delete('category')
                                            }
                                            router.push(url.pathname + url.search)
                                        }
                                    }}
                                    className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold transition-all flex-shrink-0 relative ${categoryFilter === cat.id
                                        ? "neon-tab-active"
                                        : "neon-tab-inactive"
                                        } ${cat.comingSoon ? "opacity-60 cursor-not-allowed" : ""}`}
                                >
                                    <cat.icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${categoryFilter === cat.id ? "neon-text-green" : "text-muted-foreground group-hover/tab:neon-text-green transition-colors"}`} />
                                    {cat.label}
                                    {cat.comingSoon && (
                                        <span className="ml-1 px-1 py-0.5 rounded-sm bg-neon-green/10 text-[8px] sm:text-[9px] text-neon-green uppercase tracking-tighter leading-none border border-neon-green/20">Soon</span>
                                    )}
                                    {categoryFilter === cat.id && (
                                        <div className="absolute -bottom-2 left-0 right-0 h-0.5 bg-neon-green shadow-[0_0_15px_rgba(105,255,148,0.8)] animate-in fade-in slide-in-from-left-2 duration-300" />
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </header>
    )
}
