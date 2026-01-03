import { NextResponse } from "next/server"
import { DatabaseService } from "../../../lib/database"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const marketId = searchParams.get("marketId")

        if (!marketId) {
            return NextResponse.json({ error: "marketId is required" }, { status: 400 })
        }

        // Get comments from Neon database
        const comments = await DatabaseService.getComments(marketId)

        // Transform to expected format
        const formattedComments = comments.map(comment => ({
            id: comment.id,
            marketPda: marketId, // Keep for backward compatibility
            author: comment.user,
            content: comment.content,
            timestamp: comment.createdAt.getTime(),
            isHolder: comment.isHolder
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

        // Create comment in database
        const comment = await DatabaseService.createComment({
            marketId,
            user: author,
            content: content.trim(),
            isHolder: isHolder || false
        })

        return NextResponse.json({
            id: comment.id,
            marketPda: marketId,
            author: comment.user,
            content: comment.content,
            timestamp: comment.createdAt.getTime(),
            isHolder: comment.isHolder
        })
    } catch (e) {
        console.error("Failed to create comment:", e)
        return NextResponse.json({ error: "Failed to create comment" }, { status: 500 })
    }
}