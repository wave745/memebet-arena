const { PrismaClient } = require('./src/generated')

async function testDB() {
  const prisma = new PrismaClient()

  try {
    console.log('Testing database connection...')

    // Test connection
    await prisma.$connect()
    console.log('✅ Database connected')

    // Check tables
    const activityCount = await prisma.activity.count()
    console.log(`📊 Activity table has ${activityCount} records`)

    const marketCount = await prisma.market.count()
    console.log(`📊 Market table has ${marketCount} records`)

    // Try the leaderboard query
    console.log('Testing leaderboard query...')
    const bets = await prisma.activity.findMany({
      where: {
        type: {
          in: ['BET_YES', 'BET_NO', 'SELL']
        }
      }
    })
    console.log(`📊 Found ${bets.length} betting activities`)

    // Test activity query
    console.log('Testing activity query...')
    const activities = await prisma.activity.findMany({
      take: 5,
      orderBy: { timestamp: "desc" },
      include: {
        market: {
          select: { ticker: true, tokenMint: true, category: true }
        }
      }
    })
    console.log(`📊 Found ${activities.length} recent activities`)

  } catch (error) {
    console.error('❌ Database error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testDB()