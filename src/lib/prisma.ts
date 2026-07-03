import { PrismaClient } from '@prisma/client'

// Singleton PrismaClient — Next.js hot-reload creates many module instances
// in dev, so cache the client on globalThis to avoid exhausting MySQL
// connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
