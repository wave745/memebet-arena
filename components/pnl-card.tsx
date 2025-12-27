"use client"

import React from "react"
import { SolanaLogo } from "./solana-logo"

interface PnLCardProps {
    id: string
    marketQuestion: string
    side: "YES" | "NO"
    amount: number
    pnl: number
    pnlPercent: number
    currentValue: number
}

export const PnLCard = ({
    id,
    marketQuestion,
    side,
    amount,
    pnl,
    pnlPercent,
    currentValue,
}: PnLCardProps) => {
    return (
        <div
            id={id}
            className="w-[400px] h-[500px] bg-[#0B0B0D] text-white p-8 flex flex-col justify-between relative overflow-hidden"
            style={{
                backgroundImage: 'radial-gradient(circle at 0% 0%, rgba(107, 158, 120, 0.15) 0%, transparent 50%), radial-gradient(circle at 100% 100%, rgba(166, 124, 124, 0.1) 0%, transparent 50%)',
            }}
        >
            {/* Decorative Elements */}
            <div className="absolute top-[-50px] right-[-50px] w-40 h-40 bg-[#6B9E78]/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-[-50px] left-[-50px] w-40 h-40 bg-[#A67C7C]/5 rounded-full blur-3xl"></div>

            {/* Header */}
            <div className="z-10">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-full bg-[#6B9E78] flex items-center justify-center font-bold text-black text-xs">
                        TM
                    </div>
                    <span className="font-bold text-lg tracking-wider">TRENCHMARKET</span>
                </div>
                <h2 className="text-xl font-medium leading-tight text-white/90 line-clamp-2">
                    {marketQuestion}
                </h2>
            </div>

            {/* Main Stats */}
            <div className="z-10 flex flex-col items-center">
                <div className={`px-4 py-1.5 rounded-full text-sm font-bold mb-4 ${side === "YES" ? "bg-green-500/20 text-green-500 border border-green-500/30" : "bg-red-500/20 text-red-500 border border-red-500/30"
                    }`}>
                    {side.toUpperCase()}
                </div>

                <div className={`text-6xl font-black tracking-tighter ${pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {pnl >= 0 ? "+" : ""}{pnlPercent.toFixed(1)}%
                </div>

                <div className="flex items-center gap-2 mt-4 text-white/60 font-mono">
                    <span>Profit:</span>
                    <span className={`font-bold ${pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {pnl >= 0 ? "+" : ""}{pnl.toFixed(4)} SOL
                    </span>
                </div>
            </div>

            {/* Bottom Stats & Footer */}
            <div className="z-10">
                <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-6 mb-6">
                    <div>
                        <div className="text-white/40 text-xs mb-1 uppercase tracking-widest">Investment</div>
                        <div className="flex items-center gap-1 font-mono font-bold">
                            <SolanaLogo size={14} />
                            {amount.toFixed(4)}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-white/40 text-xs mb-1 uppercase tracking-widest">Current Value</div>
                        <div className="flex items-center gap-1 font-mono font-bold justify-end text-green-500">
                            <SolanaLogo size={14} />
                            {currentValue.toFixed(4)}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-white/30 tracking-widest uppercase">
                    <span>Join the trenches</span>
                    <span>trenchmarket.xyz</span>
                </div>
            </div>

            {/* Background Grids */}
            <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                    backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
                    backgroundSize: '20px 20px'
                }}
            ></div>
        </div>
    )
}
