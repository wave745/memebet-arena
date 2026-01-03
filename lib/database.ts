import { PrismaNeon } from '@prisma/adapter-neon'
import { Pool } from '@neondatabase/serverless'

// Import the generated Prisma client directly
import { PrismaClient } from '../node_modules/.prisma/client/client'

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaNeon(new Pool({ connectionString: process.env.DATABASE_URL }) as any),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Database helper functions
export class DatabaseService {
  // Market operations
  static async upsertMarket(marketData: {
    pda: string
    tokenMint: string
    tokenSymbol?: string
    tokenName?: string
    tokenImage?: string
    targetCap: string
    endTimestamp: bigint
    resolved?: boolean
    outcome?: boolean | null
    finalMarketCap?: string
  }) {
    try {
      return await prisma.market.upsert({
        where: { pda: marketData.pda },
        update: {
          tokenSymbol: marketData.tokenSymbol,
          tokenName: marketData.tokenName,
          tokenImage: marketData.tokenImage,
          resolved: marketData.resolved,
          outcome: marketData.outcome,
          finalMarketCap: marketData.finalMarketCap,
        },
        create: {
          pda: marketData.pda,
          tokenMint: marketData.tokenMint,
          tokenSymbol: marketData.tokenSymbol,
          tokenName: marketData.tokenName,
          tokenImage: marketData.tokenImage,
          targetCap: marketData.targetCap,
          endTimestamp: marketData.endTimestamp,
          resolved: marketData.resolved || false,
          outcome: marketData.outcome,
          finalMarketCap: marketData.finalMarketCap,
        },
      })
    } catch (error) {
      console.error('Failed to upsert market:', error)
      throw error
    }
  }

  static async getMarket(pda: string) {
    try {
      return await prisma.market.findUnique({
        where: { pda },
      })
    } catch (error) {
      console.error('Failed to get market:', error)
      return null
    }
  }

  static async getAllMarkets(limit = 100, offset = 0) {
    try {
      return await prisma.market.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      })
    } catch (error) {
      console.error('Failed to get markets:', error)
      return []
    }
  }

  // Activity operations
  static async createActivity(activityData: {
    txHash: string
    type: string
    marketId: string
    user: string
    amount: string
    slot?: bigint
    timestamp?: bigint
  }) {
    try {
      // Get market ID from PDA if needed
      let marketId = activityData.marketId
      const market = await prisma.market.findUnique({
        where: { pda: activityData.marketId },
        select: { id: true }
      })

      if (market) {
        marketId = market.id
      }

      return await prisma.activity.create({
        data: {
          txHash: activityData.txHash,
          type: activityData.type,
          marketId,
          user: activityData.user,
          amount: activityData.amount,
          slot: activityData.slot || BigInt(0),
          timestamp: activityData.timestamp || BigInt(Math.floor(Date.now() / 1000)),
        },
      })
    } catch (error) {
      console.error('Failed to create activity:', error)
      throw error
    }
  }

  static async getActivities(limit = 50, marketId?: string, user?: string, types?: string[]) {
    try {
      const where: any = {}

      if (marketId) {
        // If marketId is a PDA, find the actual market ID
        const market = await prisma.market.findUnique({
          where: { pda: marketId },
          select: { id: true }
        })
        where.marketId = market?.id || marketId
      }

      if (user) {
        where.user = user
      }

      if (types && types.length > 0) {
        where.type = { in: types }
      }

      return await prisma.activity.findMany({
        where,
        include: {
          market: true,
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
      })
    } catch (error) {
      console.error('Failed to get activities:', error)
      return []
    }
  }

  // User stats operations
  static async updateUserStats(user: string, activityType: string, amount: string, isWin?: boolean) {
    try {
      const amountNum = parseFloat(amount) / 1_000_000_000 // Convert lamports to SOL

      // Get current stats
      let userStats = await prisma.userStats.findUnique({
        where: { user }
      })

      if (!userStats) {
        // Create new user stats
        userStats = await prisma.userStats.create({
          data: {
            user,
            totalVolume: amount,
            totalBets: 1,
            wins: isWin ? 1 : 0,
            losses: isWin === false ? 1 : 0,
            pnl: isWin ? amount : '0', // Simplified P&L calculation
          }
        })
      } else {
        // Update existing stats
        const currentVolume = parseFloat(userStats.totalVolume) / 1_000_000_000
        const currentPnl = parseFloat(userStats.pnl) / 1_000_000_000

        let newPnl = currentPnl
        if (activityType === 'BET_YES' || activityType === 'BET_NO') {
          // For bets, we'll track volume but P&L is calculated on resolution
          newPnl = currentPnl
        } else if (activityType === 'SELL') {
          // For sells, we might have realized P&L - simplified calculation
          newPnl = currentPnl + amountNum
        }

        await prisma.userStats.update({
          where: { user },
          data: {
            totalVolume: (currentVolume + amountNum).toString(),
            totalBets: { increment: 1 },
            wins: isWin ? { increment: 1 } : userStats.wins,
            losses: isWin === false ? { increment: 1 } : userStats.losses,
            pnl: newPnl.toString(),
            lastActive: new Date(),
          }
        })
      }

      return userStats
    } catch (error) {
      console.error('Failed to update user stats:', error)
      throw error
    }
  }

  static async getLeaderboard(limit = 50, sortBy: 'volume' | 'pnl' | 'wins' = 'volume') {
    try {
      const orderBy: any = {}

      switch (sortBy) {
        case 'volume':
          orderBy.totalVolume = 'desc'
          break
        case 'pnl':
          orderBy.pnl = 'desc'
          break
        case 'wins':
          orderBy.wins = 'desc'
          break
      }

      return await prisma.userStats.findMany({
        orderBy,
        take: limit,
      })
    } catch (error) {
      console.error('Failed to get leaderboard:', error)
      return []
    }
  }

  // Comment operations
  static async createComment(commentData: {
    marketId: string
    user: string
    content: string
    isHolder?: boolean
  }) {
    try {
      // Get market ID from PDA if needed
      let marketId = commentData.marketId
      const market = await prisma.market.findUnique({
        where: { pda: commentData.marketId },
        select: { id: true }
      })

      if (market) {
        marketId = market.id
      }

      return await prisma.comment.create({
        data: {
          marketId,
          user: commentData.user,
          content: commentData.content,
          isHolder: commentData.isHolder || false,
        },
      })
    } catch (error) {
      console.error('Failed to create comment:', error)
      throw error
    }
  }

  static async getComments(marketId: string, limit = 100) {
    try {
      // Get market ID from PDA if needed
      let actualMarketId = marketId
      const market = await prisma.market.findUnique({
        where: { pda: marketId },
        select: { id: true }
      })

      if (market) {
        actualMarketId = market.id
      }

      return await prisma.comment.findMany({
        where: { marketId: actualMarketId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
    } catch (error) {
      console.error('Failed to get comments:', error)
      return []
    }
  }
}