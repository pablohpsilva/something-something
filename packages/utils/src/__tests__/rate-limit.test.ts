import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryStore, limit, makeKey } from '../rate-limit'

describe('Rate Limiting', () => {
  beforeEach(() => {
    // Reset time mocks
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('MemoryStore', () => {
    it('should allow requests within limit', async () => {
      const store = new MemoryStore()
      const key = 'test-key'
      const windowMs = 60000 // 1 minute
      const maxRequests = 5

      // Should allow first 5 requests
      for (let i = 0; i < 5; i++) {
        const result = await store.consume(key, windowMs, maxRequests)
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(4 - i)
        expect(result.resetTime).toBeInstanceOf(Date)
      }
    })

    it('should block requests exceeding limit', async () => {
      const store = new MemoryStore()
      const key = 'test-key'
      const windowMs = 60000
      const maxRequests = 3

      // Consume all allowed requests
      for (let i = 0; i < 3; i++) {
        await store.consume(key, windowMs, maxRequests)
      }

      // Next request should be blocked
      const result = await store.consume(key, windowMs, maxRequests)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('should reset window after time expires', async () => {
      const store = new MemoryStore()
      const key = 'test-key'
      const windowMs = 60000
      const maxRequests = 2

      // Consume all requests
      await store.consume(key, windowMs, maxRequests)
      await store.consume(key, windowMs, maxRequests)

      // Should be blocked
      let result = await store.consume(key, windowMs, maxRequests)
      expect(result.allowed).toBe(false)

      // Advance time past window
      vi.advanceTimersByTime(windowMs + 1000)

      // Should be allowed again
      result = await store.consume(key, windowMs, maxRequests)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(1)
    })

    it('should handle multiple keys independently', async () => {
      const store = new MemoryStore()
      const windowMs = 60000
      const maxRequests = 2

      // Consume requests for key1
      await store.consume('key1', windowMs, maxRequests)
      await store.consume('key1', windowMs, maxRequests)

      // key1 should be blocked
      let result = await store.consume('key1', windowMs, maxRequests)
      expect(result.allowed).toBe(false)

      // key2 should still be allowed
      result = await store.consume('key2', windowMs, maxRequests)
      expect(result.allowed).toBe(true)
    })

    it('should provide accurate window information', async () => {
      const store = new MemoryStore()
      const key = 'test-key'
      const windowMs = 60000
      const maxRequests = 5

      const window = await store.getWindow(key, windowMs)
      expect(window.requests).toBe(0)
      expect(window.resetTime).toBeInstanceOf(Date)

      // Make some requests
      await store.consume(key, windowMs, maxRequests)
      await store.consume(key, windowMs, maxRequests)

      const updatedWindow = await store.getWindow(key, windowMs)
      expect(updatedWindow.requests).toBe(2)
    })
  })

  describe('makeKey', () => {
    it('should create consistent keys from same inputs', () => {
      const key1 = makeKey('user', 'action', { ip: '127.0.0.1' })
      const key2 = makeKey('user', 'action', { ip: '127.0.0.1' })
      expect(key1).toBe(key2)
    })

    it('should create different keys for different inputs', () => {
      const key1 = makeKey('user1', 'action', { ip: '127.0.0.1' })
      const key2 = makeKey('user2', 'action', { ip: '127.0.0.1' })
      expect(key1).not.toBe(key2)
    })

    it('should handle optional metadata', () => {
      const key1 = makeKey('user', 'action')
      const key2 = makeKey('user', 'action', {})
      const key3 = makeKey('user', 'action', { ip: '127.0.0.1' })

      expect(key1).toBe(key2)
      expect(key1).not.toBe(key3)
    })
  })

  describe('limit function', () => {
    it('should apply rate limiting correctly', async () => {
      const config = {
        windowMs: 60000,
        maxRequests: 3,
      }

      // First 3 requests should succeed
      for (let i = 0; i < 3; i++) {
        const result = await limit('test-user', 'test-action', config)
        expect(result.allowed).toBe(true)
      }

      // 4th request should fail
      const result = await limit('test-user', 'test-action', config)
      expect(result.allowed).toBe(false)
    })

    it('should handle different users independently', async () => {
      const config = {
        windowMs: 60000,
        maxRequests: 1,
      }

      // User 1 makes request
      let result = await limit('user1', 'action', config)
      expect(result.allowed).toBe(true)

      // User 1 is now blocked
      result = await limit('user1', 'action', config)
      expect(result.allowed).toBe(false)

      // User 2 should still be allowed
      result = await limit('user2', 'action', config)
      expect(result.allowed).toBe(true)
    })

    it('should include metadata in rate limit key', async () => {
      const config = {
        windowMs: 60000,
        maxRequests: 1,
      }

      // Same user, different IPs should be tracked separately
      let result = await limit('user1', 'action', config, { ip: '192.168.1.1' })
      expect(result.allowed).toBe(true)

      result = await limit('user1', 'action', config, { ip: '192.168.1.2' })
      expect(result.allowed).toBe(true)

      // Same IP should be blocked
      result = await limit('user1', 'action', config, { ip: '192.168.1.1' })
      expect(result.allowed).toBe(false)
    })
  })
})
