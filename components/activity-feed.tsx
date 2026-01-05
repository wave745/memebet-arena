"use client"

import { useEffect, useState } from "react"

import { formatDistanceToNow } from "date-fns"
import { Loader2, TrendingUp, TrendingDown, Gavel, Plus, DollarSign, Minus, Activity as ActivityIcon } from "lucide-react"

interface Activity {
    id: string
    type: string
    txHash: string
    user: string
    amount: string
    timestamp: number
    market: {
        ticker: string | null
        tokenMint: string
        category: string
    }
}

export function ActivityFeed() {
    const [activities, setActivities] = useState<Activity[]>([])
    const [loading, setLoading] = useState(true)
    const [isLive, setIsLive] = useState(true)
    const [lastUpdate, setLastUpdate] = useState<number>(Date.now())

    const fetchActivities = async (retryCount = 0) => {
        try {
            const res = await fetch("/api/activity?limit=50")
            if (!res.ok) throw new Error(`API error: ${res.status}`)
            const data = await res.json()
            if (Array.isArray(data)) {
                setActivities(data)
                setLastUpdate(Date.now())
            }
        } catch (e) {
            console.error("Failed to load activity", e)

            // Retry up to 3 times with exponential backoff for network/API errors
            if (retryCount < 3) {
                const delay = Math.pow(2, retryCount) * 1000 // 1s, 2s, 4s
                console.log(`Retrying activity fetch in ${delay}ms (attempt ${retryCount + 1}/3)`)
                setTimeout(() => fetchActivities(retryCount + 1), delay)
            } else {
                console.warn("Activity fetch failed after 3 retries")
                setIsLive(false) // Show as not live if we can't fetch
            }
        } finally {
            if (retryCount === 0) { // Only set loading false on first attempt
            setLoading(false)
            }
        }
    }

    useEffect(() => {
        fetchActivities()
        // Poll every 5 seconds for live updates
        const interval = setInterval(fetchActivities, 5000)
        return () => clearInterval(interval)
    }, [])

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-neon-green" />
            </div>
        )
    }

    if (activities.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-white/30 space-y-4">
                <ActivityIcon className="h-12 w-12" />
                <p>No live activity yet.</p>
            </div>
        )
    }

    return (
        <div className="max-w-3xl mx-auto">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-6 pl-4 flex items-center gap-3">
                <div className={`h-1.5 w-1.5 rounded-full animate-pulse ${isLive ? 'bg-red-500' : 'bg-green-500'}`} />
                Live Global Feed
                <span className="text-[8px] text-white/20 font-normal tracking-normal">
                    ({activities.length} activities)
                </span>
            </h2>
            <div className="space-y-3">
                {activities.map((item) => (
                    <div key={item.id} className="glass-card p-4 flex items-center gap-4 border border-white/5 hover:border-white/10 transition-all group">
                        <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center border border-white/5 group-hover:scale-110 transition-transform">
                            {item.type === 'BET_YES' && <TrendingUp className="h-5 w-5 text-neon-green" />}
                            {item.type === 'BET_NO' && <TrendingDown className="h-5 w-5 text-neon-magenta" />}
                            {item.type === 'SELL' && <Minus className="h-5 w-5 text-red-400" />}
                            {item.type === 'CREATE' && <Plus className="h-5 w-5 text-blue-400" />}
                            {item.type === 'RESOLVE' && <Gavel className="h-5 w-5 text-orange-400" />}
                            {item.type === 'REDEEM' && <DollarSign className="h-5 w-5 text-yellow-400" />}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold text-white uppercase tracking-wider">
                                    {item.type === 'BET_YES' && <span className="text-neon-green">Bought YES</span>}
                                    {item.type === 'BET_NO' && <span className="text-neon-magenta">Bought NO</span>}
                                    {item.type === 'SELL' && <span className="text-red-400">Sold Shares</span>}
                                    {item.type === 'CREATE' && <span className="text-blue-400">Deployed Market</span>}
                                    {item.type === 'RESOLVE' && <span className="text-orange-400">Resolved Market</span>}
                                    {item.type === 'REDEEM' && <span className="text-yellow-400">Claimed Winnings</span>}
                                </span>
                                <span className="text-[10px] text-white/40 font-mono">
                                    {formatDistanceToNow(item.timestamp * 1000, { addSuffix: true })}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-white/70 truncate">
                                <span className="font-mono text-white/40">{item.user.slice(0, 4)}...{item.user.slice(-4)}</span>
                                <span>on</span>
                                <span className="font-bold text-white">{item.market?.ticker || item.market?.tokenMint.slice(0, 6) || "Unknown"}</span>
                                {item.amount && (
                                    <>
                                        <div className="h-1 w-1 bg-white/20 rounded-full" />
                                        <span className="text-white font-mono">{(Number(item.amount) / 1000000000).toFixed(2)} SOL</span>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="text-right hidden sm:block">
                            <a
                                href={`https://explorer.solana.com/tx/${item.txHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white transition-colors"
                            >
                                View TX
                            </a>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
