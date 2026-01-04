import { PrismaNeon } from '@prisma/adapter-neon'
import { Pool } from '@neondatabase/serverless'

// Simple database client that avoids complex Prisma types
class SimpleDatabase {
  private prisma: any = null

  private async getClient() {
    if (!this.prisma) {
      // Use dynamic import to avoid Next.js build issues
      const { PrismaClient } = await import('../node_modules/.prisma/client/client')
      this.prisma = new PrismaClient({
        adapter: new PrismaNeon(new Pool({ connectionString: process.env.DATABASE_URL }) as any),
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      })
    }
    return this.prisma
  }

  async upsertMarket(marketData: {
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
    const client = await this.getClient()
    try {
      return await client.market.upsert({
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

  async getMarket(pda: string) {
    const client = await this.getClient()
    try {
      return await client.market.findUnique({
        where: { pda },
      })
    } catch (error) {
      console.error('Failed to get market:', error)
      return null
    }
  }

  async getAllMarkets(limit = 100, offset = 0) {
    const client = await this.getClient()
    try {
      return await client.market.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      })
    } catch (error) {
      console.error('Failed to get markets:', error)
      return []
    }
  }

  async createActivity(activityData: {
    txHash: string
    type: string
    marketId: string
    user: string
    amount: string
    slot?: bigint
    timestamp?: bigint
  }) {
    const client = await this.getClient()
    try {
      // Get market ID from PDA if needed
      let marketId = activityData.marketId
      const market = await client.market.findUnique({
        where: { pda: activityData.marketId },
        select: { id: true }
      })

      if (market) {
        marketId = market.id
      }

      return await client.activity.create({
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

  async getActivities(limit = 50, marketId?: string, user?: string, types?: string[]) {
    const client = await this.getClient()
    try {
      const where: any = {}

      if (marketId) {
        // If marketId is a PDA, find the actual market ID
        const market = await client.market.findUnique({
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

      return await client.activity.findMany({
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

  async updateUserStats(user: string, activityType: string, amount: string, isWin?: boolean) {
    const client = await this.getClient()
    try {
      const amountNum = parseFloat(amount) / 1_000_000_000 // Convert lamports to SOL

      // Get current stats
      let userStats = await client.userStats.findUnique({
        where: { user }
      })

      if (!userStats) {
        // Create new user stats
        userStats = await client.userStats.create({
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

        await client.userStats.update({
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

  async getLeaderboard(limit = 50, sortBy: 'volume' | 'pnl' | 'wins' = 'volume') {
    const client = await this.getClient()
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

      return await client.userStats.findMany({
        orderBy,
        take: limit,
      })
    } catch (error) {
      console.error('Failed to get leaderboard:', error)
      return []
    }
  }

  async createComment(commentData: {
    marketId: string
    user: string
    content: string
    isHolder?: boolean
  }) {
    const client = await this.getClient()
    try {
      // Get market ID from PDA if needed
      let marketId = commentData.marketId
      const market = await client.market.findUnique({
        where: { pda: commentData.marketId },
        select: { id: true }
      })

      if (market) {
        marketId = market.id
      }

      return await client.comment.create({
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

  async getComments(marketId: string, limit = 100) {
    const client = await this.getClient()
    try {
      // Get market ID from PDA if needed
      let actualMarketId = marketId
      const market = await client.market.findUnique({
        where: { pda: marketId },
        select: { id: true }
      })

      if (market) {
        actualMarketId = market.id
      }

      return await client.comment.findMany({
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

// Export a singleton instance
export const simpleDatabase = new SimpleDatabase()