'use server'

import { Client } from 'pg'

// Simple database client using basic pg client
// SERVER-ONLY: This file must NEVER be imported in client components
class SimpleDB {
  private client: Client | null = null

  private async getClient() {
    if (!this.client) {
      this.client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // For Neon
      })
      await this.client.connect()
    }
    return this.client
  }

  async getAllMarkets(limit = 100) {
    const client = await this.getClient()
    try {
      const query = 'SELECT * FROM "Market" ORDER BY "createdAt" DESC LIMIT $1'
      const result = await client.query(query, [limit])
      return result.rows
    } catch (error) {
      console.error('Failed to get markets:', error)
      throw error
    }
  }

  async getMarket(pda: string) {
    const client = await this.getClient()
    try {
      const query = 'SELECT * FROM "Market" WHERE pda = $1'
      const result = await client.query(query, [pda])
      return result.rows[0] || null
    } catch (error) {
      console.error('Failed to get market:', error)
      throw error
    }
  }

  async close() {
    if (this.client) {
      await this.client.end()
      this.client = null
    }
  }
}

// Export a singleton instance
export const simpleDB = new SimpleDB()