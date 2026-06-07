import { defineConfig } from 'vitest/config'
import path from 'path'
import fs from 'fs'
import { config } from 'dotenv'

// Tests MUST use .env.test — never .env (which points at production).
// If .env.test is missing, fail loudly before any test runs.
const envTestPath = path.resolve(process.cwd(), '.env.test')
if (!fs.existsSync(envTestPath)) {
  throw new Error(
    '[vitest] .env.test not found.\n' +
    'Tests require a dedicated Neon test-branch database.\n' +
    'Copy .env.test.example → .env.test and set DATABASE_URL and TEST_DATABASE_URL\n' +
    'to your test-branch connection string. Never point tests at .env (production).',
  )
}
config({ path: envTestPath })

const root = process.cwd()

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
    // Files must run sequentially — integration tests share a real Neon test-branch DB
    // and the beforeEach cleanup would conflict with concurrent file execution.
    fileParallelism: false,
  },
  resolve: {
    alias: [
      // More-specific alias must come before the general @/ catch-all
      {
        find: '@/generated/prisma/client',
        replacement: path.join(root, 'generated/prisma/client/client'),
      },
      {
        find: /^@\/(.*)/,
        replacement: `${root}/$1`,
      },
    ],
  },
})
