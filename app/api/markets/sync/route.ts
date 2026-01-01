import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { pda, tokenMint, ticker, category, targetCap, endTimestamp, resolved, outcome } = body

        const market = await prisma.market.upsert({
            where: { pda },
            update: {
                resolved,
                outcome: outcome,
                // Update category if it was 'new' and now we know better? 
                // Or if user changed it? Let's obey the payload.
                category: category,
            },
            create: {
                pda,
                tokenMint,
                ticker,
                category: category || 'new',
                targetCap: targetCap?.toString() || '0',
                endTimestamp: Number(endTimestamp),
                resolved: !!resolved,
                outcome: outcome
            }
        })

        return NextResponse.json(market)
    } catch (e) {
        console.error("Sync failed:", e)
        return NextResponse.json({ error: "Sync failed" }, { status: 500 })
    }
}
