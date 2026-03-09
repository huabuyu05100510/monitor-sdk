import { describe, it, expect, vi, afterEach } from 'vitest'
import { createJsErrorPlugin } from '../plugins/jsError'
import type { MonitorContext } from '@monit/core'

function createMockCtx(): MonitorContext {
  return {
    config: { appId: 'test', dsn: 'http://test', maxQueueSize: 10, flushInterval: 5000, plugins: [] },
    report: vi.fn(),
  }
}

describe('jsErrorPlugin', () => {
  afterEach(() => {
    window.onerror = null
  })

  it('should report js error', () => {
    const ctx = createMockCtx()
    const plugin = createJsErrorPlugin()
    plugin.setup(ctx)

    const error = new Error('test error')
    window.onerror?.('test error', 'test.js', 10, 5, error)

    expect(ctx.report).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        subType: 'js',
        payload: expect.objectContaining({
          message: 'test error',
          filename: 'test.js',
          lineno: 10,
          colno: 5,
        }),
      }),
    )
  })

  it('should remove handler on teardown', () => {
    const ctx = createMockCtx()
    const plugin = createJsErrorPlugin()
    plugin.setup(ctx)
    plugin.teardown?.()
    expect(window.onerror).toBeNull()
  })
})
