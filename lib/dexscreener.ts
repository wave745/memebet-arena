export interface TokenData {
  marketCap: number;
  image?: string;
  symbol?: string;
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

/**
 * Fetch token data from DexScreener v3 API
 * @param mint - Token mint address
 * @returns TokenData or null if not found
 */
export async function getTokenData(mint: string): Promise<TokenData | null> {
  try {
    const url = `https://api.dexscreener.com/tokens/v1/solana/${mint}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MemebetArena/1.0',
      },
    });

    if (!response.ok) {
      console.warn(`DexScreener API error for ${mint}: ${response.status}`);
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

    if (!marketCap) {
      console.warn(`No market cap found for token ${mint}`);
      return null;
    }

    return {
      marketCap,
      image: bestPair.info?.imageUrl,
      symbol: bestPair.baseToken.symbol,
    };
  } catch (error) {
    console.error(`Failed to fetch token data for ${mint}:`, error);
    return null;
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
        });
      }
    }
  } catch (error) {
    console.error(`Failed to batch fetch token data:`, error);
  }

  return result;
}