import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createFetchPlugin } from '../plugins/fetchPlugin'
import type { MonitorContext } from '@monit/core'

function createMockCtx(): MonitorContext {
  return {
    config: { appId: 'test', dsn: 'http://test', maxQueueSize: 10, flushInterval: 5000, plugins: [] },
    report: vi.fn(),
  }
}

describe('fetchPlugin', () => {
  let mockFetch: ReturnType<typeof vi.fn>
  let plugin: ReturnType<typeof createFetchPlugin>

  beforeEach(() => {
    // Mock fetch BEFORE creating plugin so originalFetch captures the mock
    mockFetch = vi.fn()
    window.fetch = mockFetch
    plugin = createFetchPlugin()
  })

  afterEach(() => {
    plugin.teardown?.()
  })

  it('should report fetch error on 4xx response', async () => {
    const ctx = createMockCtx()
    mockFetch.mockResolvedValue(new Response('Not Found', { status: 404 }))

    plugin.setup(ctx)
    await window.fetch('https://api.example.com/test')

    expect(ctx.report).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'request',
        subType: 'fetch',
        payload: expect.objectContaining({ status: 404, url: 'https://api.example.com/test' }),
      }),
    )
  })

  it('should not report on 2xx response', async () => {
    const ctx = createMockCtx()
    mockFetch.mockResolvedValue(new Response('OK', { status: 200 }))

    plugin.setup(ctx)
    await window.fetch('https://api.example.com/test')

    expect(ctx.report).not.toHaveBeenCalled()
  })

  it('should report on network error', async () => {
    const ctx = createMockCtx()
    mockFetch.mockRejectedValue(new Error('Network Error'))

    plugin.setup(ctx)
    await window.fetch('https://api.example.com/test').catch(() => {})

    expect(ctx.report).toHaveBeenCalledWith(
      expect.objectContaining({
        subType: 'fetch',
        payload: expect.objectContaining({ status: 0 }),
      }),
    )
  })
})
