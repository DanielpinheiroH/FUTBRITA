import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().optional(),
  API_PORT: z.coerce.number().int().positive().optional(),
  CORS_ORIGIN: z.string().url().optional(),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
})

export type AppConfig = Omit<z.infer<typeof envSchema>, 'API_PORT'> & { API_PORT: number }

export function loadConfig(): AppConfig {
  const parsed = envSchema.parse(process.env)
  return {
    ...parsed,
    API_PORT: parsed.PORT ?? parsed.API_PORT ?? 3333,
    WEB_ORIGIN: parsed.CORS_ORIGIN ?? parsed.WEB_ORIGIN,
  }
}
