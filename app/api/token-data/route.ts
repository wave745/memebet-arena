import { NextRequest, NextResponse } from 'next/server'
import { getBatchTokenData, getTokenData } from '@/lib/dexscreener'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mints = searchParams.get('mints')?.split(',') || []

    if (mints.length === 0) {
      return NextResponse.json(
        { error: 'No mint addresses provided' },
        { status: 400 }
      )
    }

    // Limit batch size to prevent abuse
    if (mints.length > 50) {
      return NextResponse.json(
        { error: 'Too many mint addresses. Maximum 50 allowed.' },
        { status: 400 }
      )
    }

    console.log(`Fetching token data for ${mints.length} tokens`)

    const tokenDataMap = await getBatchTokenData(mints)

    // Convert Map to object for JSON response
    const result: Record<string, any> = {}
    for (const [mint, data] of tokenDataMap) {
      if (data) {
        result[mint] = {
          price: data.price,
          marketCap: data.marketCap,
          image: data.image,
          symbol: data.symbol,
          name: data.name,
          liquidity: data.liquidity,
          volume24h: data.volume24h,
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
      count: Object.keys(result).length,
    })

  } catch (error) {
    console.error('Token data API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch token data' },
      { status: 500 }
    )
  }
}

// Also support POST for single token or batch
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mint, mints } = body

    // Handle single token request
    if (mint && typeof mint === 'string') {
      const tokenData = await getTokenData(mint)

      if (!tokenData) {
        return NextResponse.json(
          { error: 'Token data not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        data: {
          [mint]: {
            marketCap: tokenData.marketCap,
            image: tokenData.image,
            symbol: tokenData.symbol,
          }
        }
      })
    }

    // Handle batch request
    if (mints && Array.isArray(mints)) {
      if (mints.length > 50) {
        return NextResponse.json(
          { error: 'Too many mint addresses. Maximum 50 allowed.' },
          { status: 400 }
        )
      }

      console.log(`Batch fetching token data for ${mints.length} tokens`)

      const tokenDataMap = await getBatchTokenData(mints)

      const result: Record<string, any> = {}
      for (const [tokenMint, data] of tokenDataMap) {
        if (data) {
          result[tokenMint] = {
            price: data.price,
            marketCap: data.marketCap,
            image: data.image,
            symbol: data.symbol,
            name: data.name,
            liquidity: data.liquidity,
            volume24h: data.volume24h,
          }
        }
      }

      const simplifiedResult: Record<string, any> = {};
      for (const [mint, data] of Object.entries(result)) {
        simplifiedResult[mint] = {
          marketCap: data.marketCap,
          image: data.image,
          symbol: data.symbol,
        };
      }

      return NextResponse.json({
        success: true,
        data: simplifiedResult,
        count: Object.keys(simplifiedResult).length,
      })
    }

    return NextResponse.json(
      { error: 'Invalid request. Provide "mint" for single token or "mints" array for batch.' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Token data API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch token data' },
      { status: 500 }
    )
  }
}