// Comment system for Trenchmarket
// Uses Neon database for persistent storage

export interface Comment {
  id: string // Unique ID
  marketPda: string // Market PDA address (for backward compatibility)
  author: string // Wallet address
  content: string // Comment text
  timestamp: number // Unix timestamp in milliseconds
  parentId?: string // ID of parent comment (for replies)
  authorDisplayName?: string // Optional display name (future: ENS/SNS)
  isHolder?: boolean // Whether the author held a position when commenting
}

// Load comments for a market from the API
export async function loadComments(marketPda: string): Promise<Comment[]> {
  try {
    const response = await fetch(`/api/comments?marketId=${encodeURIComponent(marketPda)}`)
    if (!response.ok) {
      console.error("Failed to fetch comments:", response.status)
      return []
    }

    const comments = await response.json()

    // Transform API response to Comment interface
    const transformedComments: Comment[] = comments.map((c: any) => ({
      id: c.id,
      marketPda: c.marketPda || marketPda,
      author: c.author,
      content: c.content,
      timestamp: c.timestamp,
      isHolder: c.isHolder || false
    }))

    // Sort by timestamp (newest first)
    return transformedComments.sort((a, b) => b.timestamp - a.timestamp)
  } catch (error) {
    console.error("Failed to load comments:", error)
    return []
  }
}

// Save a comment via API
export async function saveComment(comment: Comment): Promise<void> {
  try {
    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        marketId: comment.marketPda,
        author: comment.author,
        content: comment.content,
        isHolder: comment.isHolder || false
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to save comment: ${response.status}`)
    }
  } catch (error) {
    console.error("Failed to save comment:", error)
    throw error
  }
}

// Create a new comment
export function createComment(
  marketPda: string,
  author: string,
  content: string,
  parentId?: string,
  isHolder: boolean = false
): Comment {
  // Validate content
  const trimmed = content.trim()
  if (trimmed.length === 0) {
    throw new Error("Comment cannot be empty")
  }
  if (trimmed.length > 500) {
    throw new Error("Comment cannot exceed 500 characters")
  }

  return {
    id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    marketPda,
    author,
    content: trimmed,
    timestamp: Date.now(),
    parentId,
    isHolder,
  }
}

// Organize comments into a tree structure (parent comments with nested replies)
export function organizeComments(comments: Comment[]): { topLevel: Comment[]; replies: Map<string, Comment[]> } {
  const topLevel: Comment[] = []
  const replies = new Map<string, Comment[]>()

  // Separate top-level comments and replies
  comments.forEach(comment => {
    if (comment.parentId) {
      // This is a reply
      if (!replies.has(comment.parentId)) {
        replies.set(comment.parentId, [])
      }
      replies.get(comment.parentId)!.push(comment)
    } else {
      // This is a top-level comment
      topLevel.push(comment)
    }
  })

  // Sort replies by timestamp (oldest first for replies)
  replies.forEach((replyList) => {
    replyList.sort((a, b) => a.timestamp - b.timestamp)
  })

  // Sort top-level comments by timestamp (newest first)
  topLevel.sort((a, b) => b.timestamp - a.timestamp)

  return { topLevel, replies }
}

// Format timestamp for display
export function formatCommentTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  // Less than 1 minute
  if (diff < 60000) {
    return "just now"
  }

  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000)
    return `${minutes}m ago`
  }

  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    return `${hours}h ago`
  }

  // Less than 7 days
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000)
    return `${days}d ago`
  }

  // Show date
  const date = new Date(timestamp)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  })
}

// Format address for display
export function formatCommentAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

