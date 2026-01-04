"use client"

import { useState, useEffect } from "react"
import { Trophy, Medal, Crown, TrendingUp, Activity, Users } from "lucide-react"
import { SolanaLogo } from "@/components/solana-logo"
import { formatDistanceToNow } from "date-fns"
import { useWallet } from "@/components/wallet-provider"

interface LeaderboardEntry {
    user: string
    volume: number
    pnl: number
    totalBets: number
    wins: number
    losses: number
    lastActive: number
}

export function LeaderboardFeed() {
    const { walletAddress } = useWallet()
    const [stats, setStats] = useState<LeaderboardEntry[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                console.log("LeaderboardFeed: Fetching leaderboard...")
                const res = await fetch("/api/leaderboard")
                console.log("LeaderboardFeed: Response status:", res.status, res.ok)
                if (!res.ok) throw new Error(`API error: ${res.status}`)
                const data = await res.json()
                console.log("LeaderboardFeed: Response data:", data)
                if (Array.isArray(data)) setStats(data)
            } catch (e) {
                console.error("LeaderboardFeed: Error fetching leaderboard:", e)
                // Always set empty array to prevent UI crashes
                setStats([])
            } finally {
                setLoading(false)
            }
        }

        fetchLeaderboard()
    }, [])

    const getMedalColor = (index: number) => {
        switch (index) {
            case 0: return "text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]"
            case 1: return "text-gray-300 drop-shadow-[0_0_10px_rgba(209,213,219,0.5)]"
            case 2: return "text-amber-700 drop-shadow-[0_0_10px_rgba(180,83,9,0.5)]"
            default: return "text-white/20"
        }
    }

    const getRowStyle = (index: number) => {
        switch (index) {
            case 0: return "bg-yellow-400/5 border-yellow-400/20 hover:border-yellow-400/40"
            case 1: return "bg-gray-300/5 border-gray-300/20 hover:border-gray-300/40"
            case 2: return "bg-amber-700/5 border-amber-700/20 hover:border-amber-700/40"
            default: return "bg-white/[0.02] border-white/5 hover:border-white/10"
        }
    }

    return (
        <div className="mx-auto max-w-5xl relative z-10">

            {/* Header */}
            <div className="text-center space-y-4 mb-16">
                <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 mb-4 backdrop-blur-md">
                    <Trophy className="h-8 w-8 text-neon-green" />
                </div>
                <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter shining-text">
                    Arena <span className="text-neon-green">Legends</span>
                </h2>
                <p className="text-white/40 font-mono text-sm max-w-lg mx-auto leading-relaxed">
                    Top traders dominating the prediction markets by volume and activity.
                </p>
            </div>

            {/* Grid Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div className="glass-card p-6 border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Crown className="h-20 w-20 rotate-12" />
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Total Volume</div>
                    <div className="text-3xl font-black text-white flex items-center gap-2">
                        <SolanaLogo size={24} />
                        {stats.reduce((acc, curr) => acc + curr.volume, 0).toFixed(2)}
                    </div>
                    <div className="h-1 w-20 bg-neon-green/50 mt-4 rounded-full" />
                </div>

                <div className="glass-card p-6 border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Activity className="h-20 w-20 -rotate-12" />
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Total Bets</div>
                    <div className="text-3xl font-black text-white">
                        {stats.reduce((acc, curr) => acc + curr.totalBets, 0)}
                    </div>
                    <div className="h-1 w-20 bg-neon-magenta/50 mt-4 rounded-full" />
                </div>

                <div className="glass-card p-6 border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Users className="h-20 w-20 rotate-0" />
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Active Traders</div>
                    <div className="text-3xl font-black text-white">
                        {stats.length}
                    </div>
                    <div className="h-1 w-20 bg-blue-500/50 mt-4 rounded-full" />
                </div>
            </div>

            {/* Table */}
            <div className="glass-card border border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/[0.02]">
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Rank</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Trader</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-white/30 text-right">PnL</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-white/30 text-right">Win Rate</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-white/30 text-right hidden sm:table-cell">Last Seen</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="border-b border-white/5">
                                        <td className="p-4"><div className="h-4 w-8 bg-white/5 rounded animate-pulse" /></td>
                                        <td className="p-4"><div className="h-4 w-32 bg-white/5 rounded animate-pulse" /></td>
                                        <td className="p-4"><div className="h-4 w-20 bg-white/5 rounded animate-pulse ml-auto" /></td>
                                        <td className="p-4"><div className="h-4 w-12 bg-white/5 rounded animate-pulse ml-auto" /></td>
                                    </tr>
                                ))
                            ) : stats.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-white/20 italic text-sm">
                                        No bets placed yet. Be the first legend in the arena.
                                    </td>
                                </tr>
                            ) : (
                                stats.map((user, index) => (
                                    <tr key={user.user} className={`border-b border-white/5 transition-colors ${getRowStyle(index)}`}>
                                        <td className="p-4 px-6 relative">
                                            {index < 3 ? (
                                                <Medal className={`h-6 w-6 ${getMedalColor(index)}`} />
                                            ) : (
                                                <span className="font-mono text-white/40 text-lg w-6 inline-block text-center">#{index + 1}</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`h-8 w-8 rounded-full border border-white/10 flex items-center justify-center text-[10px] font-bold ${index === 0 ? "bg-yellow-400/20 text-yellow-400" : "bg-white/5 text-white/50"
                                                    }`}>
                                                    {user.user.slice(0, 2)}
                                                </div>
                                                <div className="font-mono text-xs sm:text-sm text-white/80">
                                                    {user.user}
                                                    {user.user === walletAddress && (
                                                        <span className="ml-2 px-1.5 py-0.5 rounded bg-neon-green/20 text-neon-green text-[9px] font-black uppercase tracking-wide">You</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className={`flex items-center justify-end gap-1.5 font-bold text-sm sm:text-base ${user.pnl >= 0 ? 'text-neon-green' : 'text-red-400'}`}>
                                                <SolanaLogo size={14} />
                                                {user.pnl >= 0 ? '+' : ''}{user.pnl.toFixed(3)}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/5 text-xs">
                                                <TrendingUp className="h-3 w-3 text-neon-green" />
                                                <span className="text-white/80 font-mono">{user.totalBets > 0 ? Math.round((user.wins / user.totalBets) * 100) : 0}%</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right hidden sm:table-cell">
                                            <div className="text-xs text-white/40 font-mono">
                                                {formatDistanceToNow(user.lastActive * 1000, { addSuffix: true })}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
