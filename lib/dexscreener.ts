export interface TokenData {
  marketCap: number;
  image?: string;
  symbol?: string;
  price?: number;
  name?: string;
  liquidity?: number;
  volume24h?: number;
}

export interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    h24: {
      buys: number;
      sells: number;
    };
    h6: {
      buys: number;
      sells: number;
    };
    h1: {
      buys: number;
      sells: number;
    };
    m5: {
      buys: number;
      sells: number;
    };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv: number;
  marketCap: number;
  pairCreatedAt: number;
  info: {
    imageUrl?: string;
    header?: string;
    openGraph?: string;
    websites?: Array<{
      label: string;
      url: string;
    }>;
    socials?: Array<{
      type: string;
      url: string;
    }>;
  };
}

export interface DexScreenerResponse {
  schemaVersion: string;
  pairs: DexScreenerPair[];
}

// Simple cache to avoid repeated API calls
const tokenDataCache = new Map<string, { data: TokenData; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100; // Minimum 100ms between requests

/**
 * Fetch token data from DexScreener v3 API
 * @param mint - Token mint address
 * @returns TokenData - always returns basic data, enhanced with DexScreener if available
 */
export async function getTokenData(mint: string): Promise<TokenData> {
  try {
    // Validate mint address format
    if (!mint || typeof mint !== 'string' || mint.length < 32 || mint.length > 44) {
      console.warn(`Invalid token mint address: ${mint}`);
      return null;
    }

    // Check cache first
    const cached = tokenDataCache.get(mint);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log(`Using cached token data for ${mint}`);
      return cached.data;
    }

    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }
    lastRequestTime = Date.now();

    const url = `https://api.dexscreener.com/tokens/v1/solana/${mint}`;

    console.log(`Fetching token data for ${mint} from: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'MemebetArena/1.0',
        'Accept': 'application/json',
      },
      // Add timeout and abort controller for better error handling
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      console.warn(`DexScreener API error for ${mint}: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    // The API returns an array of pairs directly, not wrapped in an object
    const pairs = Array.isArray(data) ? data : (data.pairs || []);

    if (!pairs || pairs.length === 0) {
      console.warn(`No pairs found for token ${mint}`);
      return null;
    }

    // Find the pair with the highest liquidity (most reliable)
    const bestPair = pairs.reduce((best, current) => {
      return (current.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? current : best;
    });

    const marketCap = bestPair.marketCap || (bestPair.fdv || 0);

    // For tokens without market cap (like SOL), we still want to return the data
    // Just use 0 as market cap and continue

    const result = {
      marketCap,
      image: bestPair.info?.imageUrl,
      symbol: bestPair.baseToken.symbol,
      price: bestPair.priceUsd ? parseFloat(bestPair.priceUsd) : undefined,
      name: bestPair.baseToken.name,
      liquidity: bestPair.liquidity?.usd,
      volume24h: bestPair.volume?.h24,
    };

    // Cache the result
    tokenDataCache.set(mint, { data: result, timestamp: Date.now() });

    return result;
  } catch (error: any) {
    console.error(`Failed to fetch token data for ${mint}:`, {
      error: error.message || error,
      type: error.name,
      url: `https://api.dexscreener.com/tokens/v1/solana/${mint}`,
      isNetworkError: error.message?.includes('fetch') || error.name === 'TypeError',
      isTimeout: error.name === 'TimeoutError' || error.message?.includes('timeout'),
      isAbort: error.name === 'AbortError'
    });

    // Return cached data if available, even if expired
    const cached = tokenDataCache.get(mint);
    if (cached) {
      console.log(`Using expired cached data for ${mint} due to API failure`);
      return cached.data;
    }

    // Return basic token data on API failure
    console.warn(`API failure for ${mint}, returning basic data`);
    return {
      marketCap: 0,
      image: undefined,
      symbol: 'UNKNOWN',
      price: undefined,
      name: 'Unknown Token',
      liquidity: undefined,
      volume24h: undefined,
    };
  }
}

/**
 * Batch fetch multiple tokens from DexScreener
 * @param mints - Array of token mint addresses
 * @returns Map of mint to TokenData
 */
export async function getBatchTokenData(mints: string[]): Promise<Map<string, TokenData>> {
  const result = new Map<string, TokenData>();

  if (mints.length === 0) {
    return result;
  }

  // DexScreener supports comma-separated addresses
  const mintsParam = mints.join(',');
  const url = `https://api.dexscreener.com/tokens/v1/solana/${mintsParam}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MemebetArena/1.0',
      },
    });

    if (!response.ok) {
      console.warn(`DexScreener batch API error: ${response.status}`);
      return result;
    }

    const data = await response.json();

    // Handle both single token (array) and batch responses
    const pairs = Array.isArray(data) ? data : (data.pairs || []);

    if (!pairs || pairs.length === 0) {
      return result;
    }

    // Group pairs by token address
    const pairsByToken = new Map<string, DexScreenerPair[]>();
    for (const pair of pairs) {
      const tokenAddress = pair.baseToken.address;
      if (!pairsByToken.has(tokenAddress)) {
        pairsByToken.set(tokenAddress, []);
      }
      pairsByToken.get(tokenAddress)!.push(pair);
    }

    // Process each token
    for (const [tokenAddress, pairs] of pairsByToken) {
      // Find the pair with the highest liquidity
      const bestPair = pairs.reduce((best, current) => {
        return (current.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? current : best;
      });

      const marketCap = bestPair.marketCap || (bestPair.fdv || 0);
      if (marketCap) {
        result.set(tokenAddress, {
          marketCap,
          image: bestPair.info?.imageUrl,
          symbol: bestPair.baseToken.symbol,
          price: bestPair.priceUsd ? parseFloat(bestPair.priceUsd) : undefined,
          name: bestPair.baseToken.name,
          liquidity: bestPair.liquidity?.usd,
          volume24h: bestPair.volume?.h24,
        });
      }
    }
  } catch (error) {
    console.error(`Failed to batch fetch token data:`, error);
  }

  return result;
}