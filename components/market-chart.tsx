"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Dot } from "recharts"

interface ChartDataPoint {
  time: string
  value: number
}

interface MarketChartProps {
  data: ChartDataPoint[]
  currentValue: number
  color?: string
}

// Custom dot component for the end point
const CustomDot = (props: any) => {
  const { cx, cy, payload, color, index, data } = props
  // Check if this is the last data point - recharts provides index and we pass data
  if (payload && data && typeof index === 'number' && index === data.length - 1) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={4} fill={color || "#60A5FA"} stroke="#0B0B0D" strokeWidth={2} />
      </g>
    )
  }
  return null
}

// Custom label for the end point
const CustomLabel = (props: any) => {
  const { x, y, value, payload, color, index, data } = props
  // Check if this is the last data point - recharts provides index and we pass data
  if (payload && data && typeof index === 'number' && index === data.length - 1) {
    return (
      <text
        x={x + 8}
        y={y}
        fill={color || "#60A5FA"}
        fontSize={12}
        fontWeight={500}
        textAnchor="start"
      >
        {value?.toFixed(1) || "0.0"}%
      </text>
    )
  }
  return null
}

export function MarketChart({ data, currentValue, color = "#60A5FA" }: MarketChartProps) {
  // Add isLast flag to the last data point
  const dataWithFlags = data.map((point, index) => ({
    ...point,
    isLast: index === data.length - 1,
  }))

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={dataWithFlags}
          margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
        >
          <defs>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={color} stopOpacity={1} />
              <stop offset="100%" stopColor={color} stopOpacity={1} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#1E3A8A"
            strokeOpacity={0.3}
            horizontal={true}
            vertical={false}
          />
          <XAxis
            dataKey="time"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#8A8A8A", fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#8A8A8A", fontSize: 11 }}
            domain={["auto", "auto"]}
            width={40}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={(props) => {
              const { key, ...restProps } = props
              return <CustomDot key={key} {...restProps} color={color} data={dataWithFlags} />
            }}
            label={(props) => {
              const { key, ...restProps } = props
              return <CustomLabel key={key} {...restProps} color={color} data={dataWithFlags} />
            }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// Helper function to generate sample data based on time range
export function generateChartData(
  timeRange: "1H" | "6H" | "1D" | "1W" | "1M" | "ALL",
  currentValue: number
): ChartDataPoint[] {
  const now = new Date()
  const data: ChartDataPoint[] = []
  
  let intervals = 20
  let minutesPerInterval = 3
  
  switch (timeRange) {
    case "1H":
      intervals = 20
      minutesPerInterval = 3
      break
    case "6H":
      intervals = 24
      minutesPerInterval = 15
      break
    case "1D":
      intervals = 24
      minutesPerInterval = 60
      break
    case "1W":
      intervals = 28
      minutesPerInterval = 360
      break
    case "1M":
      intervals = 30
      minutesPerInterval = 1440
      break
    case "ALL":
      intervals = 30
      minutesPerInterval = 1440
      break
  }

  // Generate data points with some variation
  for (let i = intervals; i >= 0; i--) {
    const time = new Date(now.getTime() - i * minutesPerInterval * 60 * 1000)
    const hours = time.getHours()
    const minutes = time.getMinutes()
    const ampm = hours >= 12 ? "pm" : "am"
    const displayHours = hours % 12 || 12
    const timeLabel = `${displayHours}:${minutes.toString().padStart(2, "0")}${ampm}`
    
    // Create variation in the data (simulate market movements)
    const variation = (Math.sin(i * 0.5) * 0.3 + Math.random() * 0.2 - 0.1) * currentValue
    const value = Math.max(0.1, Math.min(99.9, currentValue + variation))
    
    data.push({
      time: timeLabel,
      value: value,
    })
  }

  return data
}

