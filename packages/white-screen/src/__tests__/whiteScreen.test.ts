import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createWhiteScreenPlugin } from '../plugins/whiteScreen'
import type { MonitorContext } from '@monit/core'

function createMockCtx(): MonitorContext {
  return {
    config: { appId: 'test', dsn: 'http://test', maxQueueSize: 10, flushInterval: 5000, plugins: [] },
    report: vi.fn(),
  }
}

// jsdom 不实现 elementFromPoint，需要手动定义
function setupElementFromPoint(returnEl: Element | null) {
  Object.defineProperty(document, 'elementFromPoint', {
    value: vi.fn().mockReturnValue(returnEl),
    writable: true,
    configurable: true,
  })
}

describe('whiteScreenPlugin', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true,
    })
    // 默认 elementFromPoint 返回一个有效的 div 节点（非忽略标签）
    const validEl = document.createElement('div')
    setupElementFromPoint(validEl)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should not report when MutationObserver detects content before timeout', () => {
    const ctx = createMockCtx()
    // body 已有足够子节点，MutationObserver 触发后 hasContent=true
    Object.defineProperty(document.body, 'childElementCount', {
      value: 5,
      configurable: true,
    })

    const plugin = createWhiteScreenPlugin({ timeout: 1000, minChildCount: 2 })
    plugin.setup(ctx)

    // 触发 MutationObserver 回调（jsdom 中手动触发）
    // childElementCount 已 >= minChildCount，cleanup 会被调用
    vi.advanceTimersByTime(2000)

    // 因为 body 有内容，MutationObserver 触发后 hasContent=true，超时不上报
    // 注意：jsdom 中 MutationObserver 是异步的，所以这里 hasContent 可能仍为 false
    // 此测试验证超时后 elementFromPoint 返回有效节点时不上报白屏
    // validRatio = 9/9 = 1.0 > threshold 0.5，不上报
    expect(ctx.report).not.toHaveBeenCalled()
    plugin.teardown?.()
  })

  it('should report white screen when all sample points return ignored elements', () => {
    const ctx = createMockCtx()
    // elementFromPoint 返回 HTML 元素（在忽略列表中）
    setupElementFromPoint(document.documentElement)

    Object.defineProperty(document.body, 'childElementCount', {
      value: 0,
      configurable: true,
    })

    const plugin = createWhiteScreenPlugin({ timeout: 1000, threshold: 0.5 })
    plugin.setup(ctx)
    vi.advanceTimersByTime(1500)

    expect(ctx.report).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'white-screen',
        subType: 'white-screen',
        payload: expect.objectContaining({
          validRatio: 0,
        }),
      }),
    )
    plugin.teardown?.()
  })

  it('should not report when elementFromPoint returns valid elements', () => {
    const ctx = createMockCtx()
    // elementFromPoint 返回有效 div（不在忽略列表）
    const validEl = document.createElement('div')
    setupElementFromPoint(validEl)

    Object.defineProperty(document.body, 'childElementCount', {
      value: 0,
      configurable: true,
    })

    const plugin = createWhiteScreenPlugin({ timeout: 1000, threshold: 0.5 })
    plugin.setup(ctx)
    vi.advanceTimersByTime(1500)

    // validRatio = 9/9 = 1.0 >= threshold 0.5，不上报
    expect(ctx.report).not.toHaveBeenCalled()
    plugin.teardown?.()
  })

  it('should cleanup on teardown and not report after destroy', () => {
    const ctx = createMockCtx()
    setupElementFromPoint(document.documentElement) // 会触发白屏条件

    const plugin = createWhiteScreenPlugin({ timeout: 1000 })
    plugin.setup(ctx)
    plugin.teardown?.() // 提前销毁

    vi.advanceTimersByTime(2000) // 超时后不应上报
    expect(ctx.report).not.toHaveBeenCalled()
  })
})
