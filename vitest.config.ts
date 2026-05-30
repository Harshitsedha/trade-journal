import { defineConfig } from 'vitest/config'
import path from 'path'
import { config } from 'dotenv'

// Load .env before any module touches process.env
config({ path: path.resolve(process.cwd(), '.env') })

const root = process.cwd()

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
    // Files must run sequentially — they share a real Neon DB and the
    // beforeEach cleanup would conflict with concurrent file execution.
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
