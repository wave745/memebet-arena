import { NextRequest, NextResponse } from 'next/server'
import { getTokenData } from '@/lib/dexscreener'

console.log('API route loaded, getTokenData function:', typeof getTokenData)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mint = searchParams.get('mint')

    if (!mint || typeof mint !== 'string' || mint.length < 32 || mint.length > 44) {
      return NextResponse.json(
        { error: `Invalid token mint address: "${mint}" (length: ${mint?.length})` },
        { status: 400 }
      )
    }

    const tokenData = await getTokenData(mint)

    // getTokenData now always returns data (never null)
    return NextResponse.json(tokenData)

  } catch (error: any) {
    console.error(`API: Failed to fetch token data:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}