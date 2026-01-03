"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useWallet } from "@/components/wallet-provider"
import { PublicKey } from "@solana/web3.js"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Zap,
    Twitter as TwitterIcon,
    Users,
    TrendingUp,
    Bot,
    ArrowLeft,
    Loader2,
    Plus,
    ShieldAlert,
    Info,
    ChevronRight,
    Eye
} from "lucide-react"
import { createMarket } from "@/lib/anchor/markets"
import { getMarketPda } from "@/lib/anchor/program"
import * as anchor from "@coral-xyz/anchor"
import Link from "next/link"
import { XLogo } from "@/components/x-logo"
import { formatMarketCapShort } from "@/lib/utils/format-market-cap"
import { getTokenData, type TokenData } from "@/lib/dexscreener"

// Helper to save created markets to localStorage
function saveCreatedMarket(pda: string, ticker: string, category: string) {
    const stored = localStorage.getItem('created_markets')
    const markets = stored ? JSON.parse(stored) : []
    // Avoid duplicates
    if (!markets.find((m: any) => m.pda === pda)) {
        markets.push({ pda, ticker, category, createdAt: Date.now() })
        localStorage.setItem('created_markets', JSON.stringify(markets))
    }
}

// We'll use a mocked preview version of MarketCard to avoid complexity in this file
function MarketPreview({ data }: { data: any }) {
    const resolveDate = data.endDate ? new Date(data.endDate) : new Date()

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-white/40 text-[10px] uppercase tracking-widest font-black">
                <Eye className="h-3 w-3" /> Arena Preview
            </div>
            <div className="relative glass-card overflow-hidden border border-white/10 p-4 space-y-4 opacity-100 scale-100 transition-all">
                <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black text-white/20 uppercase">
                        {data.ticker?.slice(0, 2) || "TM"}
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-white leading-tight">
                            Will {data.ticker || "TOKEN"} hit ${formatMarketCapShort(data.targetCap || "1000")}?
                        </h3>
                        <div className="text-[10px] text-white/40 font-mono mt-1">
                            Resolves {resolveDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-neon-green">YES</span>
                        <span className="text-white">50%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex">
                        <div className="h-full bg-neon-green/40 w-1/2" />
                        <div className="h-full bg-neon-magenta/40 w-1/2" />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-neon-magenta">NO</span>
                        <span className="text-white">50%</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="h-8 rounded bg-neon-green/10 border border-neon-green/20 flex items-center justify-center text-[10px] font-black text-neon-green uppercase tracking-tighter">YES</div>
                    <div className="h-8 rounded bg-neon-magenta/10 border border-neon-magenta/20 flex items-center justify-center text-[10px] font-black text-neon-magenta uppercase tracking-tighter">NO</div>
                </div>
            </div>

            <div className="glass-card p-4 border border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-2">
                    <Info className="h-3 w-3 text-white/40" />
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Metadata Verify</span>
                </div>
                <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px]">
                        <span className="text-white/30 uppercase">Category</span>
                        <span className="text-neon-green font-bold uppercase">{data.category}</span>
                    </div>
                    <div className="text-[10px] text-white/50 leading-relaxed italic border-l border-white/10 pl-2">
                        "{data.rules}"
                    </div>
                </div>
            </div>
        </div>
    )
}

const ADMIN_PUBKEY = "3zAjK7AzN7Wdor2i3kzcNrdRJc8PzysspjbgG8awp5NB"

// Categories for curator to assign (hot/new are auto-computed, not manually assigned)
const CATEGORIES = [
    { id: "trenches", label: "Trenches", icon: Zap },
    { id: "kols", label: "KOLs", icon: XLogo },
    { id: "cabals", label: "Cabals", icon: Users },
    { id: "whales", label: "Whales", icon: TrendingUp },
    { id: "ai", label: "AI", icon: Bot },
]

export default function AdminPage() {
    const { walletConnected, walletAddress, connection, wallet } = useWallet()
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [authorized, setAuthorized] = useState<boolean | null>(null)

    // Form State
    const [tokenMint, setTokenMint] = useState("")
    const [ticker, setTicker] = useState("")
    const [targetCap, setTargetCap] = useState("1000")
    const [tokenData, setTokenData] = useState<TokenData | null>(null)
    const [fetchingTokenData, setFetchingTokenData] = useState(false)

    // Fetch token data and auto-populate ticker
    const fetchTokenData = useCallback(async (mint: string) => {
        setFetchingTokenData(true)
        try {
            const data = await getTokenData(mint)
            setTokenData(data)

            // Auto-populate ticker if it's empty and we got data
            if (data?.symbol && !ticker.trim()) {
                setTicker(data.symbol.toUpperCase())
            }
        } catch (error) {
            console.warn('Failed to fetch token data:', error)
            setTokenData(null)
        } finally {
            setFetchingTokenData(false)
        }
    }, [ticker])

    const [endDate, setEndDate] = useState("")
    const [dateError, setDateError] = useState<string | null>(null)
    const [category, setCategory] = useState("trenches")
    const [rules, setRules] = useState("Market resolves YES if token reaches target market cap before the end date. Resolves NO otherwise.")
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null)
    const [whitelist, setWhitelist] = useState<string[]>([])
    const [showWhitelistManager, setShowWhitelistManager] = useState(false)
    const [newWhitelistWallet, setNewWhitelistWallet] = useState("")

    // Load whitelist from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('tm_whitelist')
        if (saved) {
            try {
                setWhitelist(JSON.parse(saved))
            } catch (e) {
                console.error("Failed to parse whitelist")
            }
        }
    }, [])

    // Persistence
    const saveWhitelist = (newList: string[]) => {
        setWhitelist(newList)
        localStorage.setItem('tm_whitelist', JSON.stringify(newList))
    }

    useEffect(() => {
        if (walletConnected && walletAddress) {
            const isWhitelisted = whitelist.includes(walletAddress)
            if (walletAddress === ADMIN_PUBKEY || isWhitelisted) {
                setAuthorized(true)
            } else {
                setAuthorized(false)
                setTimeout(() => router.push("/"), 2000)
            }
        }
    }, [walletConnected, walletAddress, router, whitelist])

    // Auto-fetch token data when mint is complete (immediate for better UX)
    useEffect(() => {
        if (tokenMint && tokenMint.length === 44) {
            // Immediate fetch when mint address is complete
            fetchTokenData(tokenMint)
        } else {
            // Clear data if mint becomes invalid
            setTokenData(null)
        }
    }, [tokenMint]) // Only depend on tokenMint to avoid dependency array size changes

    const handleAddToWhitelist = () => {
        if (!newWhitelistWallet) return
        try {
            new PublicKey(newWhitelistWallet) // Validate
            if (whitelist.includes(newWhitelistWallet)) return
            saveWhitelist([...whitelist, newWhitelistWallet])
            setNewWhitelistWallet("")
        } catch (e) {
            alert("Invalid Solana Public Key")
        }
    }

    const handleRemoveFromWhitelist = (addr: string) => {
        saveWhitelist(whitelist.filter(a => a !== addr))
    }

    const handleDeploy = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!connection || !wallet || !walletAddress) return

        // Validate date
        if (!endDate) {
            setStatus({
                type: 'error',
                msg: 'Please enter a valid expiry date and time'
            })
            return
        }

        const selectedDate = new Date(endDate)
        if (isNaN(selectedDate.getTime())) {
            setStatus({
                type: 'error',
                msg: 'Invalid date format. Please use the date picker.'
            })
            return
        }

        // Check if date is in the future
        const now = new Date()
        if (selectedDate <= now) {
            setStatus({
                type: 'error',
                msg: 'Expiry date must be in the future'
            })
            return
        }

        setLoading(true)
        setStatus(null)

        try {
            const mintPubkey = new PublicKey(tokenMint)
            const capBN = new anchor.BN(parseFloat(targetCap))
            const endBN = new anchor.BN(Math.floor(selectedDate.getTime() / 1000))

            // Get the PDA before creating
            const [marketPda] = getMarketPda(mintPubkey, capBN, endBN)

            const tx = await createMarket(connection, wallet, mintPubkey, capBN, endBN)

            // Save to localStorage so it appears on the main page
            saveCreatedMarket(marketPda.toString(), ticker || tokenMint.slice(0, 6), category)

            // Sync to database so all users can see the market
            console.log("Syncing market to database:", marketPda.toString())
            const syncResponse = await fetch(window.location.origin + '/api/markets/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pda: marketPda.toString(),
                    tokenMint: tokenMint,
                    ticker: ticker || tokenMint.slice(0, 6),
                    category: category,
                    targetCap: capBN,
                    endTimestamp: endBN,
                    resolved: false
                })
            })
            console.log("Sync response:", syncResponse.status, await syncResponse.text())

            // Notify Activity Backend
            fetch('/api/activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    txHash: tx,
                    type: 'CREATE',
                    marketPda: marketPda.toString(),
                    user: walletAddress,
                    amount: "0",
                    marketInfo: {
                        tokenMint: tokenMint,
                        ticker: ticker || tokenMint.slice(0, 6),
                        targetCap: parseFloat(targetCap), // just for metadata
                        endTimestamp: Math.floor(selectedDate.getTime() / 1000),
                        resolved: false,
                        category: category
                    }
                })
            }).catch(console.error)

            setStatus({
                type: 'success',
                msg: `MARKET_DEPLOYED! PDA: ${marketPda.toString().slice(0, 12)}... TX: ${tx.slice(0, 8)}...`
            })

            setTokenMint("")
            setTicker("")
        } catch (err: any) {
            console.error("Deploy failed:", err)
            // Extract meaningful error message
            let errorMsg = "DEPLOYMENT_FAILURE"
            const fullError = err?.message || err?.logs?.join(" ") || ""

            // Check for common errors
            if (fullError.includes("already in use")) {
                errorMsg = "MARKET_ALREADY_EXISTS: A market with these exact parameters already exists. Try different target cap or end date."
            } else if (fullError.includes("Unauthorized")) {
                errorMsg = "UNAUTHORIZED: Only admin wallet can create markets"
            } else if (fullError.includes("insufficient") || fullError.includes("debit")) {
                errorMsg = "INSUFFICIENT_BALANCE: Not enough SOL for transaction"
            } else if (fullError.includes("InvalidEndTimestamp")) {
                errorMsg = "INVALID_DATE: End timestamp must be in the future"
            } else if (fullError.includes("Unexpected error") || fullError.includes("User rejected")) {
                errorMsg = "WALLET_BLOCKED: Phantom blocked this request. Try on localhost or add site to trusted apps."
            } else if (err?.message) {
                errorMsg = err.message.slice(0, 200)
            }

            setStatus({
                type: 'error',
                msg: errorMsg
            })
        } finally {
            setLoading(false)
        }
    }

    if (authorized === false) {
        return (
            <div className="min-h-screen bg-[#0B0B0D] flex items-center justify-center p-6">
                <div className="glass-card p-12 text-center space-y-6 max-w-sm border border-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.1)]">
                    <div className="flex justify-center">
                        <ShieldAlert className="h-12 w-12 text-red-500 animate-pulse" />
                    </div>
                    <div className="text-red-500 font-black text-2xl uppercase tracking-tighter">SEC_VIOLATION</div>
                    <div className="text-white/40 text-sm italic">"Your clearance level is insufficient for this sector."</div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#060608] text-white selection:bg-neon-green/30 selection:text-black font-sans">
            {/* Background Mesh */}
            <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(105,255,148,0.03),transparent_50%)] pointer-events-none" />
            <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)] pointer-events-none" />

            {/* Floating Header */}
            <header className="fixed top-0 left-0 right-0 z-[100] backdrop-blur-xl bg-black/60 border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-28 flex items-center justify-between">
                    <div className="flex flex-col">
                        <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter leading-none shining-text">
                            CURA<span className="text-neon-green">TOR</span>
                        </h1>
                        <p className="text-[10px] md:text-xs text-white/40 font-mono italic tracking-tight mt-2 opacity-80 uppercase tracking-[0.1em]">
                            Deploying global prediction markets to the arena.
                        </p>
                    </div>

                    <div className="flex items-center gap-8">
                        <Link href="/" className="hidden lg:flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white transition-all group">
                            <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-1 transition-transform" /> Back to Arena
                        </Link>

                        <div className="flex items-center gap-4 bg-white/[0.03] border border-white/10 p-4 rounded-2xl relative group/auth">
                            <div className="space-y-0.5">
                                <div className="text-[10px] font-black text-neon-green uppercase tracking-widest text-right">Auth Verified</div>
                                <div className="text-[11px] font-mono text-white/40 tracking-tight">{walletAddress?.slice(0, 6)}...{walletAddress?.slice(-6)}</div>
                            </div>
                            <button
                                onClick={() => setShowWhitelistManager(!showWhitelistManager)}
                                disabled={walletAddress !== ADMIN_PUBKEY}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${walletAddress === ADMIN_PUBKEY ? 'bg-neon-green/10 border border-neon-green/30 hover:shadow-[0_0_20px_rgba(105,255,148,0.15)]' : 'bg-white/5 border border-white/5 opacity-50 cursor-not-allowed'}`}
                            >
                                <Plus className={`h-5 w-5 text-neon-green transition-transform ${showWhitelistManager ? 'rotate-45' : ''}`} />
                            </button>

                            {/* Whitelist Manager Dropdown */}
                            {showWhitelistManager && (
                                <div className="absolute top-[calc(100%+12px)] right-0 w-80 glass-card p-6 border border-white/10 z-[100] animate-in fade-in slide-in-from-top-4 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)]">
                                    <h3 className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-4">Manage Permissions</h3>
                                    <div className="space-y-4">
                                        <div className="flex gap-2">
                                            <Input
                                                value={newWhitelistWallet}
                                                onChange={(e) => setNewWhitelistWallet(e.target.value)}
                                                placeholder="Wallet Address..."
                                                className="bg-black/40 border-white/10 h-10 text-[10px] font-mono focus:border-neon-green/40 transition-all"
                                            />
                                            <Button onClick={handleAddToWhitelist} size="sm" className="h-10 px-3 bg-neon-green text-black hover:bg-neon-green/90">
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                            {whitelist.length === 0 && (
                                                <div className="text-[10px] text-white/20 italic text-center py-4">No additional wallets whitelisted.</div>
                                            )}
                                            {whitelist.map(addr => (
                                                <div key={addr} className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5">
                                                    <span className="text-[10px] font-mono text-white/60 truncate mr-2">{addr.slice(0, 12)}...{addr.slice(-4)}</span>
                                                    <button
                                                        onClick={() => handleRemoveFromWhitelist(addr)}
                                                        className="text-white/20 hover:text-red-500 transition-colors"
                                                    >
                                                        <Zap className="h-3 w-3 rotate-180" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="pt-2 border-t border-white/5">
                                            <div className="text-[10px] text-white/20 italic">Only Root Admin can manage this list.</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <div className="relative max-w-6xl mx-auto px-6 pt-40 pb-24 md:pt-48 space-y-16">

                {/* Main Interface */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

                    {/* Form Side */}
                    <div className="lg:col-span-7 space-y-8">
                        <form onSubmit={handleDeploy} className="space-y-10">

                            {/* Token Identity Section */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="h-px flex-1 bg-white/10" />
                                    <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] whitespace-nowrap">01 // Identity</span>
                                    <div className="h-px flex-1 bg-white/10" />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Solana Mint Address</label>
                                        <Input
                                            value={tokenMint}
                                            onChange={(e) => setTokenMint(e.target.value)}
                                            placeholder="MINT_ADDRESS"
                                            className="bg-white/5 border-white/10 h-14 focus:border-neon-green/50 transition-all font-mono text-xs tracking-tight placeholder:text-white/10"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1 flex items-center gap-2">
                                            Asset Ticker
                                            {fetchingTokenData && (
                                                <div className="animate-spin rounded-full h-3 w-3 border border-white/20 border-t-white/60"></div>
                                            )}
                                        </label>
                                        <Input
                                            value={ticker}
                                            onChange={(e) => setTicker(e.target.value.toUpperCase())}
                                            placeholder="e.g. BONK"
                                            className="bg-white/5 border-white/10 h-14 focus:border-neon-green/50 transition-all font-black uppercase text-sm tracking-widest"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Economic Rules Section */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="h-px flex-1 bg-white/10" />
                                    <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] whitespace-nowrap">02 // Economic Rules</span>
                                    <div className="h-px flex-1 bg-white/10" />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Target Market Cap (USD)</label>
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                step="1"
                                                value={targetCap}
                                                onChange={(e) => setTargetCap(e.target.value)}
                                                className="bg-white/5 border-white/10 h-14 focus:border-neon-green/50 transition-all font-black text-xl pl-10"
                                                required
                                            />
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 font-black">$</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Expiry Date & Time</label>
                                        <Input
                                            type="datetime-local"
                                            value={endDate}
                                            onChange={(e) => {
                                                const value = e.target.value
                                                setEndDate(value)
                                                // Clear error when user starts typing
                                                if (dateError) setDateError(null)
                                                // Validate format
                                                if (value && !value.includes('T')) {
                                                    setDateError('Please select both date and time')
                                                } else if (value) {
                                                    const date = new Date(value)
                                                    if (isNaN(date.getTime())) {
                                                        setDateError('Invalid date format')
                                                    } else if (date <= new Date()) {
                                                        setDateError('Date must be in the future')
                                                    } else {
                                                        setDateError(null)
                                                    }
                                                }
                                            }}
                                            onBlur={(e) => {
                                                const value = e.target.value
                                                if (value && !value.includes('T')) {
                                                    setDateError('Please select both date and time')
                                                }
                                            }}
                                            className={`bg-white/5 border-white/10 h-14 focus:border-neon-green/50 transition-all font-bold text-sm ${dateError ? 'border-red-500/50' : ''}`}
                                            required
                                            min={new Date().toISOString().slice(0, 16)}
                                            step="60"
                                        />
                                        {dateError && (
                                            <p className="text-xs text-red-400 mt-1">{dateError}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Market Resolution Rules</label>
                                    <textarea
                                        value={rules}
                                        onChange={(e) => setRules(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 min-h-[140px] text-sm text-white/70 focus:border-neon-green/50 focus:outline-none transition-all resize-none shadow-inner italic"
                                    />
                                </div>
                            </div>

                            {/* Deployment Trigger */}
                            <div className="pt-6">
                                {status && (
                                    <div className={`p-5 rounded-2xl border text-xs font-black mb-6 animate-in fade-in slide-in-from-top-2 tracking-widest ${status.type === 'success' ? 'bg-neon-green/10 border-neon-green/30 text-neon-green' : 'bg-red-500/10 border-red-500/30 text-red-400'
                                        }`}>
                                        {status.msg}
                                    </div>
                                )}

                                <Button
                                    type="submit"
                                    disabled={loading || !walletConnected}
                                    className="w-full h-20 bg-neon-green hover:bg-neon-green/90 text-black font-black uppercase tracking-[0.2em] text-lg shadow-[0_20px_60px_-15px_rgba(105,255,148,0.3)] disabled:opacity-50 transition-all group rounded-2xl border-none active:scale-95"
                                >
                                    {loading ? (
                                        <Loader2 className="h-8 w-8 animate-spin" />
                                    ) : (
                                        <span className="flex items-center gap-3">
                                            Initialize On-Chain PDA <ChevronRight className="h-6 w-6 group-hover:translate-x-2 transition-transform" />
                                        </span>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>

                    {/* Sidebar Area */}
                    <div className="lg:col-span-5 space-y-10">

                        {/* Real-time Preview */}
                        <MarketPreview data={{ ticker, targetCap, endDate, category, rules }} />

                        {/* Categorization */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] whitespace-nowrap">Categorization</span>
                                <div className="h-px flex-1 bg-white/10" />
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {CATEGORIES.map(cat => {
                                    const Icon = cat.icon
                                    return (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => setCategory(cat.id)}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-[11px] font-black uppercase tracking-tighter ${category === cat.id
                                                ? 'bg-neon-green text-black border-neon-green shadow-[0_10px_30px_-5px_rgba(105,255,148,0.4)]'
                                                : 'bg-white/5 border-white/5 text-white/30 hover:bg-white/10 hover:border-white/10'
                                                }`}
                                        >
                                            <Icon className="h-3 w-3" size={14} />
                                            {cat.label}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Market Sync Section */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] whitespace-nowrap">Market Sync</span>
                                <div className="h-px flex-1 bg-white/10" />
                            </div>

                            <div className="glass-card p-6 border border-white/5 bg-white/[0.01] space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                                    <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">Database Sync</h3>
                                </div>
                                <div className="space-y-3">
                                    <p className="text-[11px] text-white/40 leading-relaxed">
                                        Sync all markets from the blockchain to the database. This ensures the latest market data is available.
                                    </p>
                                    <Button
                                        onClick={async () => {
                                            setStatus({ type: 'success', msg: 'Syncing markets...' })
                                            try {
                                                const response = await fetch('/api/markets/sync-all', {
                                                    method: 'POST'
                                                })
                                                const result = await response.json()

                                                if (result.success) {
                                                    setStatus({
                                                        type: 'success',
                                                        msg: `✅ Markets synced! Database now contains ${result.marketsCount} markets.`
                                                    })
                                                } else {
                                                    setStatus({
                                                        type: 'error',
                                                        msg: `❌ Sync failed: ${result.error}`
                                                    })
                                                }
                                            } catch (error: any) {
                                                setStatus({
                                                    type: 'error',
                                                    msg: `❌ Sync failed: ${error.message}`
                                                })
                                            }
                                        }}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-widest text-sm"
                                        disabled={loading}
                                    >
                                        Sync Markets to Database
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="glass-card p-8 border border-white/5 bg-white/[0.01] space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-ping" />
                                <h3 className="text-[10px] font-black text-orange-400 uppercase tracking-[0.3em]">Curation Notes</h3>
                            </div>
                            <ul className="space-y-3">
                                {[
                                    "PDA accounts are immutable once broadcast.",
                                    "End date must be at least 24h from now.",
                                    "Rules define the narrative of the bet.",
                                    "Curator balance required for rent (0.001 SOL)."
                                ].map((text, i) => (
                                    <li key={i} className="flex gap-3 text-[11px] text-white/40 leading-relaxed italic">
                                        <span className="text-white/10 font-mono">0{i + 1}</span>
                                        {text}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}
