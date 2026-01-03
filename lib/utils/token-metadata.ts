import { Connection, PublicKey } from "@solana/web3.js"

// Cache for token metadata to avoid repeated API calls
const tokenCache = new Map<string, { symbol: string; name: string; image?: string; lastFetched: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export interface TokenMetadata {
  symbol: string
  name: string
  image?: string
}

/**
 * Fetch token metadata from DexScreener API
 */
async function fetchFromDexScreener(mintStr: string): Promise<TokenMetadata | null> {
  try {
    const response = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mintStr}`)

    if (!response.ok) return null

    const data = await response.json()
    if (!data || data.length === 0) return null

    const pair = data[0] // Use the first pair
    const baseToken = pair.baseToken

    return {
      symbol: baseToken.symbol,
      name: baseToken.name,
      image: baseToken.logoURI || pair.info?.imageUrl
    }
  } catch (error) {
    console.warn('DexScreener fetch failed:', error)
    return null
  }
}

/**
 * Fetch token metadata from Helius API (more reliable for metadata)
 */
async function fetchFromHelius(mintStr: string): Promise<TokenMetadata | null> {
  try {
    // Note: You'll need to add your Helius API key to environment variables
    const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY

    if (!heliusApiKey) {
      console.warn('Helius API key not configured, falling back to DexScreener')
      return fetchFromDexScreener(mintStr)
    }

    const response = await fetch(`https://api.helius.dev/v0/tokens/metadata?api-key=${heliusApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mintAccounts: [mintStr] })
    })

    if (!response.ok) return null

    const data = await response.json()
    if (!data || data.length === 0) return null

    const token = data[0]

    return {
      symbol: token.symbol || token.name || 'UNKNOWN',
      name: token.name || token.symbol || 'Unknown Token',
      image: token.logoURI || token.image
    }
  } catch (error) {
    console.warn('Helius fetch failed:', error)
    return fetchFromDexScreener(mintStr)
  }
}

/**
 * Get token symbol and metadata for a mint address
 * Uses caching and falls back through multiple sources
 */
export async function getTokenMetadata(mintStr: string): Promise<TokenMetadata> {
  // Check cache first
  const cached = tokenCache.get(mintStr)
  if (cached && Date.now() - cached.lastFetched < CACHE_DURATION) {
    return cached
  }

  // Try Helius first (most reliable for metadata)
  let metadata = await fetchFromHelius(mintStr)

  // Fallback to DexScreener
  if (!metadata) {
    metadata = await fetchFromDexScreener(mintStr)
  }

  // Final fallback
  if (!metadata) {
    metadata = {
      symbol: 'UNKNOWN',
      name: 'Unknown Token'
    }
  }

  // Cache the result
  tokenCache.set(mintStr, {
    ...metadata,
    lastFetched: Date.now()
  })

  return metadata
}

/**
 * Get token symbol only (lighter weight for when you don't need full metadata)
 */
export async function getTokenSymbol(mintStr: string): Promise<string> {
  const metadata = await getTokenMetadata(mintStr)
  return metadata.symbol
}

/**
 * Format token display for UI - shows symbol with fallback to truncated address
 */
export function formatTokenDisplay(mintStr: string, symbol?: string): string {
  if (symbol && symbol !== 'UNKNOWN') {
    return symbol
  }

  // Fallback to truncated address
  return `${mintStr.slice(0, 4)}...${mintStr.slice(-4)}`
}

/**
 * Clear token cache (useful for testing or forced refresh)
 */
export function clearTokenCache(): void {
  tokenCache.clear()
}