/**
 * Formats a market cap value (in raw dollars) to a human-readable string
 * Examples:
 * - 1000 → "$1k"
 * - 100000 → "$100k"
 * - 1000000 → "$1M"
 * - 1000000000 → "$1B"
 */
export function formatMarketCap(value: number | bigint | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : Number(value)
  
  if (isNaN(num) || num === 0) return "$0"
  
  if (num >= 1_000_000_000) {
    return `$${(num / 1_000_000_000).toFixed(1)}B`
  }
  if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(1)}M`
  }
  if (num >= 1_000) {
    return `$${(num / 1_000).toFixed(0)}k`
  }
  
  return `$${num.toFixed(0)}`
}

/**
 * Formats a market cap value for display in questions
 * Examples:
 * - 1000 → "1k"
 * - 100000 → "100k"
 * - 1000000 → "1M"
 */
export function formatMarketCapShort(value: number | bigint | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : Number(value)
  
  if (isNaN(num) || num === 0) return "0"
  
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(0)}k`
  }
  
  return num.toFixed(0)
}

