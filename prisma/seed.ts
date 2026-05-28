import { PrismaClient, Prisma } from '../app/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import 'dotenv/config'

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const options: Prisma.PrismaClientOptions = { adapter }
const db = new PrismaClient(options)

const defaultSetups = [
  { name: 'ORB', description: 'Opening Range Breakout — first 5-15min candle break' },
  { name: 'VWAP Reclaim', description: 'Price reclaims VWAP after deviation' },
  { name: 'Breakout', description: 'Key level breakout with volume confirmation' },
  { name: 'Reversal', description: 'Mean reversion at key support/resistance' },
  { name: 'Earnings Play', description: 'Post-earnings continuation or reversal' },
  { name: 'Trend Continuation', description: 'Pullback entry in an established trend' },
]

async function main() {
  for (const setup of defaultSetups) {
    await db.setup.upsert({
      where: { name: setup.name },
      update: {},
      create: setup,
    })
  }
  console.log(`Seeded ${defaultSetups.length} default setups.`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
