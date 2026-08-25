import { config as loadDotenv } from 'dotenv'
import { defineConfig } from 'prisma/config'

loadDotenv({ path: new URL('../../.env', import.meta.url), quiet: true })

export default defineConfig({
  earlyAccess: true,
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
})
