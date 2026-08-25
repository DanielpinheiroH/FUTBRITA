import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url))
dotenv.config({ path: rootEnv, quiet: true })

const require = createRequire(import.meta.url)
const vitest = join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs')
const files = [
  'tests/postgres.integration.test.ts',
  'tests/rodadas.postgres.integration.test.ts',
  'tests/jogo.postgres.integration.test.ts',
  'tests/partidas.postgres.integration.test.ts',
  'tests/statistics.postgres.integration.test.ts',
]
const result = spawnSync(process.execPath, [vitest, 'run', '--no-file-parallelism', ...files], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  stdio: 'inherit',
  env: {
    ...process.env,
    RUN_DATABASE_INTEGRATION: 'true',
    INTEGRATION_ADMIN_EMAIL: process.env.INTEGRATION_ADMIN_EMAIL ?? process.env.ADMIN_INITIAL_EMAIL,
    INTEGRATION_ADMIN_PASSWORD: process.env.INTEGRATION_ADMIN_PASSWORD ?? process.env.ADMIN_INITIAL_PASSWORD,
  },
})

process.exit(result.status ?? 1)
