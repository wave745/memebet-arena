import 'dotenv/config'
import { Pool } from '@neondatabase/serverless'

async function listMarkets() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })

  try {
    const client = await pool.connect()
    const result = await client.query('SELECT pda, "tokenSymbol" FROM "Market"')
    console.log(`Found ${result.rows.length} markets:`)
    result.rows.forEach(row => {
      console.log(`- ${row.pda} (${row.tokenSymbol})`)
    })
    client.release()
  } catch (error) {
    console.error(error)
  } finally {
    await pool.end()
  }
}

listMarkets()
