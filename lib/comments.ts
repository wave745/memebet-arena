// Comment system for Trenchmarket
// v1: Uses localStorage (temporary, per-browser)
// Future: Upgrade to Arweave/IPFS for permanent, decentralized storage

export interface Comment {
  id: string // Unique ID (timestamp + random)
  marketPda: string // Market PDA address
  author: string // Wallet address
  content: string // Comment text
  timestamp: number // Unix timestamp in milliseconds
  parentId?: string // ID of parent comment (for replies)
  authorDisplayName?: string // Optional display name (future: ENS/SNS)
}

const STORAGE_KEY_PREFIX = "trenchmarket_comments_"

// Get storage key for a market
function getStorageKey(marketPda: string): string {
  return `${STORAGE_KEY_PREFIX}${marketPda}`
}

// Load comments for a market
export function loadComments(marketPda: string): Comment[] {
  if (typeof window === "undefined") return []
  
  try {
    const key = getStorageKey(marketPda)
    const stored = localStorage.getItem(key)
    if (!stored) return []
    
    const comments = JSON.parse(stored) as Comment[]
    
    // Validate comments structure
    const validComments = comments.filter(c => 
      c && 
      typeof c.id === 'string' && 
      typeof c.marketPda === 'string' && 
      typeof c.author === 'string' && 
      typeof c.content === 'string' &&
      typeof c.timestamp === 'number'
    )
    
    // Sort by timestamp (newest first)
    return validComments.sort((a, b) => b.timestamp - a.timestamp)
  } catch (error) {
    console.error("Failed to load comments:", error)
    return []
  }
}

// Save a comment
export function saveComment(comment: Comment): void {
  if (typeof window === "undefined") return
  
  try {
    const key = getStorageKey(comment.marketPda)
    const existing = loadComments(comment.marketPda)
    
    // Check if comment already exists (by ID) to avoid duplicates
    const exists = existing.some(c => c.id === comment.id)
    if (exists) {
      // Update existing comment
      const updated = existing.map(c => c.id === comment.id ? comment : c)
      localStorage.setItem(key, JSON.stringify(updated))
    } else {
      // Add new comment
      const updated = [comment, ...existing]
      localStorage.setItem(key, JSON.stringify(updated))
    }
  } catch (error) {
    console.error("Failed to save comment:", error)
    // If storage quota exceeded, try to handle gracefully
    if (error instanceof DOMException && error.code === 22) {
      console.error("localStorage quota exceeded. Consider cleaning old comments.")
    }
    throw error
  }
}

// Create a new comment
export function createComment(
  marketPda: string,
  author: string,
  content: string,
  parentId?: string
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

