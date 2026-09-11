import './src/lib/env'
import prisma from './src/lib/prisma'

async function run() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      is_verified: true,
      created_at: true,
    }
  })
  console.log("USERS_LIST:", JSON.stringify(users, null, 2))
  await prisma.$disconnect()
}

run().catch(e => {
  console.error(e)
  process.exit(1)
})
