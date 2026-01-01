const { PrismaClient } = require('../../node_modules/.prisma/client/client')

const globalForPrisma = global as unknown as { prisma: any }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
