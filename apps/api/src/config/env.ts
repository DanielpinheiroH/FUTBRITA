import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3333),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
})

export type AppConfig = z.infer<typeof envSchema>

export function loadConfig(): AppConfig {
  return envSchema.parse(process.env)
}
