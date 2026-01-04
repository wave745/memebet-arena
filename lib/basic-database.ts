'use server'

import { Pool } from '@neondatabase/serverless'

// Basic database client using raw SQL to avoid Prisma type issues
// SERVER-ONLY: This file must NEVER be imported in client components
class BasicDatabase {
  private pool: Pool

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    })
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
    const client = await this.pool.connect()
    try {
      const query = `
        INSERT INTO "Market" (
          pda, "tokenMint", "tokenSymbol", "tokenName", "tokenImage",
          "targetCap", "endTimestamp", resolved, outcome, "finalMarketCap"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (pda) DO UPDATE SET
          "tokenSymbol" = EXCLUDED."tokenSymbol",
          "tokenName" = EXCLUDED."tokenName",
          "tokenImage" = EXCLUDED."tokenImage",
          resolved = EXCLUDED.resolved,
          outcome = EXCLUDED.outcome,
          "finalMarketCap" = EXCLUDED."finalMarketCap"
        RETURNING *
      `

      const values = [
        marketData.pda,
        marketData.tokenMint,
        marketData.tokenSymbol,
        marketData.tokenName,
        marketData.tokenImage,
        marketData.targetCap,
        marketData.endTimestamp.toString(),
        marketData.resolved || false,
        marketData.outcome,
        marketData.finalMarketCap
      ]

      const result = await client.query(query, values)
      return result.rows[0]
    } catch (error) {
      console.error('Failed to upsert market:', error)
      throw error
    } finally {
      client.release()
    }
  }

  async getMarket(pda: string) {
    const client = await this.getPool().connect()
    try {
      const query = 'SELECT * FROM "Market" WHERE pda = $1'
      const result = await client.query(query, [pda])
      return result.rows[0] || null
    } catch (error) {
      console.error('Failed to get market:', error)
      return null
    } finally {
      client.release()
    }
  }

  async getAllMarkets(limit = 100, offset = 0) {
    const client = await this.pool.connect()
    try {
      const query = 'SELECT * FROM "Market" ORDER BY "createdAt" DESC LIMIT $1 OFFSET $2'
      const result = await client.query(query, [limit, offset])
      return result.rows
    } catch (error) {
      console.error('Failed to get markets:', error)
      return []
    } finally {
      client.release()
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
    const client = await this.getPool().connect()
    try {
      // First, get the market ID from PDA if needed
      let marketId = activityData.marketId
      const marketQuery = 'SELECT id FROM "Market" WHERE pda = $1'
      const marketResult = await client.query(marketQuery, [activityData.marketId])

      if (marketResult.rows[0]) {
        marketId = marketResult.rows[0].id
      }

      const query = `
        INSERT INTO "Activity" (
          "txHash", type, "marketId", "user", amount, slot, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `

      const values = [
        activityData.txHash,
        activityData.type,
        marketId,
        activityData.user,
        activityData.amount,
        activityData.slot?.toString() || '0',
        activityData.timestamp?.toString() || Math.floor(Date.now() / 1000).toString()
      ]

      const result = await client.query(query, values)
      return result.rows[0]
    } catch (error) {
      console.error('Failed to create activity:', error)
      throw error
    } finally {
      client.release()
    }
  }

  async getActivities(limit = 50, marketId?: string, user?: string, types?: string[]) {
    const client = await this.getPool().connect()
    try {
      let query = `
        SELECT a.*, m.* as market
        FROM "Activity" a
        LEFT JOIN "Market" m ON a."marketId" = m.id
        WHERE 1=1
      `
      const values: any[] = []
      let paramCount = 0

      if (marketId) {
        // If marketId is a PDA, find the actual market ID
        const marketQuery = 'SELECT id FROM "Market" WHERE pda = $1'
        const marketResult = await client.query(marketQuery, [marketId])
        if (marketResult.rows[0]) {
          query += ` AND a."marketId" = $${++paramCount}`
          values.push(marketResult.rows[0].id)
        } else {
          query += ` AND a."marketId" = $${++paramCount}`
          values.push(marketId)
        }
      }

      if (user) {
        query += ` AND a."user" = $${++paramCount}`
        values.push(user)
      }

      if (types && types.length > 0) {
        query += ` AND a.type = ANY($${++paramCount})`
        values.push(types)
      }

      query += ` ORDER BY a.timestamp DESC LIMIT $${++paramCount}`
      values.push(limit)

      const result = await client.query(query, values)
      return result.rows
    } catch (error) {
      console.error('Failed to get activities:', error)
      return []
    } finally {
      client.release()
    }
  }

  async updateUserStats(user: string, activityType: string, amount: string, isWin?: boolean) {
    const client = await this.getPool().connect()
    try {
      const amountNum = parseFloat(amount) / 1_000_000_000 // Convert lamports to SOL

      // Check if user stats exist
      const checkQuery = 'SELECT * FROM "UserStats" WHERE "user" = $1'
      const checkResult = await client.query(checkQuery, [user])

      if (checkResult.rows.length === 0) {
        // Create new user stats
        const insertQuery = `
          INSERT INTO "UserStats" (
            "user", "totalVolume", "totalBets", wins, losses, pnl
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `
        await client.query(insertQuery, [
          user,
          amount,
          1,
          isWin ? 1 : 0,
          isWin === false ? 1 : 0,
          isWin ? amount : '0'
        ])
      } else {
        // Update existing stats
        const currentStats = checkResult.rows[0]
        const currentVolume = parseFloat(currentStats.totalVolume) / 1_000_000_000
        const currentPnl = parseFloat(currentStats.pnl) / 1_000_000_000

        let newPnl = currentPnl
        if (activityType === 'BET_YES' || activityType === 'BET_NO') {
          newPnl = currentPnl
        } else if (activityType === 'SELL') {
          newPnl = currentPnl + amountNum
        }

        const updateQuery = `
          UPDATE "UserStats"
          SET
            "totalVolume" = $1,
            "totalBets" = "totalBets" + 1,
            wins = CASE WHEN $2 THEN wins + 1 ELSE wins END,
            losses = CASE WHEN $3 THEN losses + 1 ELSE losses END,
            pnl = $4,
            "lastActive" = NOW()
          WHERE "user" = $5
        `

        await client.query(updateQuery, [
          (currentVolume + amountNum).toString(),
          isWin ? true : false,
          isWin === false ? true : false,
          newPnl.toString(),
          user
        ])
      }

      // Return updated stats
      const result = await client.query(checkQuery, [user])
      return result.rows[0]
    } catch (error) {
      console.error('Failed to update user stats:', error)
      throw error
    } finally {
      client.release()
    }
  }

  async getLeaderboard(limit = 50, sortBy: 'volume' | 'pnl' | 'wins' = 'volume') {
    const client = await this.getPool().connect()
    try {
      let orderBy = '"totalVolume" DESC'
      if (sortBy === 'pnl') {
        orderBy = 'pnl DESC'
      } else if (sortBy === 'wins') {
        orderBy = 'wins DESC'
      }

      const query = `SELECT * FROM "UserStats" ORDER BY ${orderBy} LIMIT $1`
      const result = await client.query(query, [limit])
      return result.rows
    } catch (error) {
      console.error('Failed to get leaderboard:', error)
      return []
    } finally {
      client.release()
    }
  }

  async createComment(commentData: {
    marketId: string
    user: string
    content: string
    isHolder?: boolean
  }) {
    const client = await this.getPool().connect()
    try {
      // Get market ID from PDA if needed
      let marketId = commentData.marketId
      const marketQuery = 'SELECT id FROM "Market" WHERE pda = $1'
      const marketResult = await client.query(marketQuery, [commentData.marketId])

      if (marketResult.rows[0]) {
        marketId = marketResult.rows[0].id
      }

      const query = `
        INSERT INTO "Comment" ("marketId", "user", content, "isHolder")
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `

      const values = [
        marketId,
        commentData.user,
        commentData.content,
        commentData.isHolder || false
      ]

      const result = await client.query(query, values)
      return result.rows[0]
    } catch (error) {
      console.error('Failed to create comment:', error)
      throw error
    } finally {
      client.release()
    }
  }

  async getComments(marketId: string, limit = 100) {
    const client = await this.getPool().connect()
    try {
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

      const result = await client.query(query, [actualMarketId, limit])
      return result.rows
    } catch (error) {
      console.error('Failed to get comments:', error)
      return []
    } finally {
      client.release()
    }
  }
}

// Export a singleton instance
export const basicDatabase = new BasicDatabase()