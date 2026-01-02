"use client"

import { useMemo } from "react"
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Dot, ReferenceLine } from "recharts"
import { PublicKey } from "@solana/web3.js"
import * as anchor from "@coral-xyz/anchor"

interface ChainMarketData {
  marketPda: PublicKey
  tokenMint: PublicKey
  targetMarketCap: anchor.BN
  endTimestamp: anchor.BN
  resolved: boolean
  yesPool: anchor.BN
  noPool: anchor.BN
  outcome: boolean | null
}

interface ProbabilityChartProps {
  market: ChainMarketData
  side: "YES" | "NO"
}

// Calculate probability from pool ratios
function calculateProbability(yesPool: anchor.BN, noPool: anchor.BN): number {
  const yesPoolBigInt = BigInt(yesPool.toString())
  const noPoolBigInt = BigInt(noPool.toString())
  const total = yesPoolBigInt + noPoolBigInt
  if (total === 0n) return 50
  return Number((yesPoolBigInt * 10000n) / total) / 100
}

// Historical data will come from indexer API in production
// For now, return empty array - no mock data
function generateHistory(market: ChainMarketData, side: "YES" | "NO") {
  // TODO: Integrate with indexer API for real historical probability data
  // For now, return only current data point
  const currentYesProb = calculateProbability(market.yesPool, market.noPool)
  const currentNoProb = 100 - currentYesProb
  
  return [{
    time: new Date(),
    timestamp: Date.now(),
    yesProb: currentYesProb,
    noProb: currentNoProb,
  }]
}

export function ProbabilityChart({ market, side }: ProbabilityChartProps) {
  const history = useMemo(() => generateHistory(market, side), [market, side])
  
  // Calculate current probability from actual pool data
  const currentYesProb = calculateProbability(market.yesPool, market.noPool)
  const currentNoProb = 100 - currentYesProb
  const currentProb = side === "YES" ? currentYesProb : currentNoProb
  
  // Calculate 24-hour change (find point closest to 24 hours ago)
  const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000)
  let previousProb = currentProb
  
  // Find the closest historical point to 24 hours ago
  for (let i = history.length - 2; i >= 0; i--) {
    if (history[i].timestamp <= twentyFourHoursAgo) {
      previousProb = side === "YES" ? history[i].yesProb : history[i].noProb
      break
    }
  }
  
  // If no point found, use the first point as fallback
  if (previousProb === currentProb && history.length > 1) {
    previousProb = side === "YES" ? history[0].yesProb : history[0].noProb
  }
  
  const change = currentProb - previousProb
  const changePercent = Math.abs(change)
  
  // Format data for chart
  const chartData = history.map((point) => ({
    time: point.time.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: side === "YES" ? point.yesProb : point.noProb,
    fullTime: point.time,
  }))
  
  // Muted, professional colors matching Polymarket
  // YES: muted cyan/blue, NO: muted red/pink
  const lineColor = side === "YES" ? "#3BA4FF" : "#FF6B9D"
  
  return (
    <div className="w-full">
      {/* Current Probability Display - Outside the canvas */}
      <div className="mb-6 flex items-center justify-between">
        <div className="text-3xl font-bold text-[#E5E5E5] leading-tight">
          {currentProb.toFixed(0)}% chance
        </div>
        <div className={`text-lg font-semibold flex items-center gap-1 ${
          change >= 0 ? "text-[#6B9E78]" : "text-[#A67C7C]"
        }`}>
          {change >= 0 ? "▲" : "▼"} {changePercent.toFixed(0)}%
        </div>
      </div>
      
      {/* Chart - Matching Polymarket style exactly */}
      <div className="h-[320px] w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={chartData} 
            margin={{ top: 10, right: 50, left: 0, bottom: 30 }}
          >
            {/* X-axis - show dates at start and end */}
            <XAxis 
              dataKey="time" 
              stroke="rgba(138, 138, 138, 0.3)"
              tick={{ fill: "rgba(138, 138, 138, 0.6)", fontSize: 11 }}
              interval="preserveStartEnd"
              tickLine={false}
              axisLine={false}
            />
            {/* Y-axis - on the right side, clear labels */}
            <YAxis 
              domain={[0, 100]}
              orientation="right"
              stroke="rgba(138, 138, 138, 0.2)"
              tick={{ fill: "rgba(138, 138, 138, 0.6)", fontSize: 11 }}
              tickFormatter={(value) => `${value}%`}
              width={50}
              tickLine={false}
              axisLine={false}
              ticks={[0, 25, 50, 75, 100]}
            />
            {/* Horizontal grid lines - using ReferenceLine for proper dotted lines */}
            <ReferenceLine y={0} stroke="rgba(255, 255, 255, 0.1)" strokeDasharray="2 2" />
            <ReferenceLine y={25} stroke="rgba(255, 255, 255, 0.1)" strokeDasharray="2 2" />
            <ReferenceLine y={50} stroke="rgba(255, 255, 255, 0.1)" strokeDasharray="2 2" />
            <ReferenceLine y={75} stroke="rgba(255, 255, 255, 0.1)" strokeDasharray="2 2" />
            <ReferenceLine y={100} stroke="rgba(255, 255, 255, 0.1)" strokeDasharray="2 2" />
            {/* Main line - smooth, quiet, one line only */}
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={lineColor} 
              strokeWidth={2.5} 
              dot={false}
              isAnimationActive={false}
            />
            {/* Last point - larger, more prominent dot */}
            <Line
              type="monotone"
              dataKey="value"
              stroke="transparent"
              strokeWidth={0}
              dot={<Dot r={7} fill={lineColor} stroke="#0F0F11" strokeWidth={3} />}
              data={[chartData[chartData.length - 1]]}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
        
      </div>
    </div>
  )
}
