import { beforeAll, afterAll, afterEach } from 'vitest'

// Mock environment variables for testing
beforeAll(() => {
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test_db'
  process.env.ABUSE_IP_SALT = 'test-ip-salt'
  process.env.ABUSE_UA_SALT = 'test-ua-salt'
})

// Clean up after each test
afterEach(() => {
  // Reset any global state if needed
})

afterAll(() => {
  // Global cleanup
})
