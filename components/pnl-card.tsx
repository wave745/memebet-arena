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
    tokenMint?: string
}

export const PnLCard = ({
    id,
    marketQuestion,
    side,
    amount,
    pnl,
    pnlPercent,
    currentValue,
    tokenMint,
}: PnLCardProps) => {
    return (
        <div
            id={id}
            className="w-[400px] h-[500px] bg-[#0B0B0D] text-white p-8 flex flex-col justify-between relative overflow-hidden shining-modal liquid-glass-shimmer"
            style={{
                backgroundImage: 'radial-gradient(circle at 0% 0%, rgba(105, 255, 148, 0.15) 0%, transparent 50%), radial-gradient(circle at 100% 100%, rgba(255, 0, 255, 0.1) 0%, transparent 50%)',
            }}
        >
            {/* Background Token Logo */}
            {tokenMint && (
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.12] pointer-events-none scale-150 rotate-[20deg] blur-[1px]">
                    <img
                        src={`https://api.dicebear.com/7.x/identicon/svg?seed=${tokenMint}`}
                        alt=""
                        className="w-full h-full object-contain grayscale brightness-150"
                    />
                </div>
            )}

            {/* Glassy Reflection Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none z-20"></div>
            {/* Decorative Elements */}
            <div className="absolute top-[-50px] right-[-50px] w-40 h-40 bg-[#6B9E78]/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-[-50px] left-[-50px] w-40 h-40 bg-[#A67C7C]/5 rounded-full blur-3xl"></div>

            {/* Header */}
            <div className="z-10">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-full bg-neon-green flex items-center justify-center font-bold text-black text-xs shadow-[0_0_10px_var(--neon-green)]">
                        TM
                    </div>
                    <span className="font-bold text-lg tracking-wider neon-text-green">TRENCHMARKET</span>
                </div>
                <h2 className="text-xl font-medium leading-tight text-white/90 line-clamp-2">
                    {marketQuestion}
                </h2>
            </div>

            {/* Main Stats */}
            <div className="z-10 flex flex-col items-center">
                <div className={`px-4 py-1.5 rounded-full text-xs font-bold mb-4 ${side === "YES"
                    ? "bg-neon-green/10 neon-text-green neon-border-green border"
                    : "bg-neon-magenta/10 neon-text-magenta neon-border-magenta border"
                    }`}>
                    {side.toUpperCase()}
                </div>

                <div className={`text-6xl font-black tracking-tighter ${pnl >= 0 ? "neon-text-green" : "neon-text-magenta"}`}>
                    {pnl >= 0 ? "+" : ""}{pnlPercent.toFixed(1)}%
                </div>

                <div className="flex items-center gap-2 mt-4 text-white/60 font-mono">
                    <span>{pnl >= 0 ? "Profit" : "Loss"}:</span>
                    <span className={`font-bold ${pnl >= 0 ? "neon-text-green" : "neon-text-magenta"}`}>
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
                        <div className="text-white/40 text-[10px] mb-1 uppercase tracking-widest">Current Value</div>
                        <div className={`flex items-center gap-1 font-mono font-bold justify-end ${currentValue >= amount ? "neon-text-green" : "neon-text-magenta"}`}>
                            <SolanaLogo size={14} />
                            {currentValue.toFixed(4)}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-white/30 tracking-widest uppercase relative z-30">
                    <span>Join the trenches</span>
                    <span>trench-market.fun</span>
                </div>
            </div>

            <div
                className="absolute inset-0 opacity-10 pointer-events-none glass-grid"
                style={{
                    backgroundSize: '30px 30px'
                }}
            ></div>
        </div>
    )
}
