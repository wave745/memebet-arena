import { NextResponse } from "next/server"
import { Pool } from '@neondatabase/serverless'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const marketId = searchParams.get("marketId")

        if (!marketId) {
            return NextResponse.json({ error: "marketId is required" }, { status: 400 })
        }

        // Get comments from Neon database inline
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_DFs85ANlpHJC@ep-royal-paper-ahfywd90-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
        })

        const client = await pool.connect()

        // Get market ID from PDA if needed
        let actualMarketId = marketId
        const marketQuery = 'SELECT id FROM "Market" WHERE pda = $1'
        const marketResult = await client.query(marketQuery, [marketId])

        if (marketResult.rows[0]) {
            actualMarketId = marketResult.rows[0].id
        }

        const query = `
            SELECT * FROM "Comment"
            WHERE "marketId" = $1
            ORDER BY "createdAt" DESC
            LIMIT $2
        `

        const result = await client.query(query, [actualMarketId, 100])
        const comments = result.rows

        client.release()
        await pool.end()

        // Transform to expected format
        const formattedComments = comments.map(comment => ({
            id: comment.id,
            marketPda: marketId, // Keep for backward compatibility
            author: comment.user,
            content: comment.content,
            timestamp: new Date(comment.createdat).getTime(),
            isHolder: comment.isholder
        }))

        return NextResponse.json(formattedComments)
    } catch (e) {
        console.error("Failed to fetch comments:", e)
        return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { marketId, author, content, isHolder } = body

        if (!marketId || !author || !content) {
            return NextResponse.json({ error: "marketId, author, and content are required" }, { status: 400 })
        }

        if (content.trim().length === 0) {
            return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 })
        }

        if (content.trim().length > 500) {
            return NextResponse.json({ error: "Comment cannot exceed 500 characters" }, { status: 400 })
        }

        // Create comment in database inline
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_DFs85ANlpHJC@ep-royal-paper-ahfywd90-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
        })

        const client = await pool.connect()

        try {
            // Get market ID from PDA if needed
            let actualMarketId = marketId
            const marketQuery = 'SELECT id FROM "Market" WHERE pda = $1'
            const marketResult = await client.query(marketQuery, [marketId])

            if (marketResult.rows[0]) {
                actualMarketId = marketResult.rows[0].id
            }

            const query = `
                INSERT INTO "Comment" ("marketId", "user", content, "isHolder")
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `

            const values = [
                actualMarketId,
                author,
                content.trim(),
                isHolder || false
            ]

            const result = await client.query(query, values)
            const comment = result.rows[0]

            return NextResponse.json({
                id: comment.id,
                marketPda: marketId,
                author: comment.user,
                content: comment.content,
                timestamp: new Date(comment.createdat).getTime(),
                isHolder: comment.isholder
            })
        } finally {
            client.release()
            await pool.end()
        }
    } catch (e) {
        console.error("Failed to create comment:", e)
        return NextResponse.json({ error: "Failed to create comment" }, { status: 500 })
    }
}