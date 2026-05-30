import { PrismaClient, Prisma } from '../generated/prisma/client/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import 'dotenv/config'

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const options: Prisma.PrismaClientOptions = { adapter }
const db = new PrismaClient(options)

const legacySetupNames = [
  'ORB',
  'VWAP Reclaim',
  'Breakout',
  'Reversal',
  'Earnings Play',
  'Trend Continuation',
]

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.log('Seed: skipped in production environment')
    return
  }

  const deleted = await db.setup.deleteMany({
    where: { name: { in: legacySetupNames } },
  })
  console.log(`Removed ${deleted.count} legacy seed setups.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
