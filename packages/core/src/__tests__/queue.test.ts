import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ReportQueue } from '../queue'
import type { MonitorEvent } from '../types'

// mock document.addEventListener / removeEventListener
const listeners: Record<string, EventListener> = {}
Object.defineProperty(document, 'addEventListener', {
  value: vi.fn((event: string, handler: EventListener) => {
    listeners[event] = handler
  }),
  writable: true,
})
Object.defineProperty(document, 'removeEventListener', {
  value: vi.fn((event: string) => {
    delete listeners[event]
  }),
  writable: true,
})

function makeEvent(overrides: Partial<MonitorEvent> = {}): MonitorEvent {
  return {
    appId: 'test-app',
    type: 'error',
    subType: 'js',
    timestamp: Date.now(),
    url: 'http://localhost',
    userAgent: 'test-agent',
    payload: {},
    ...overrides,
  }
}

describe('ReportQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should flush when queue reaches maxSize', () => {
    const reportFn = vi.fn()
    const queue = new ReportQueue(3, 5000, reportFn)

    queue.push(makeEvent())
    queue.push(makeEvent())
    expect(reportFn).not.toHaveBeenCalled()

    queue.push(makeEvent())
    expect(reportFn).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ appId: 'test-app' })]),
    )
    queue.destroy()
  })

  it('should flush on timer interval', () => {
    const reportFn = vi.fn()
    const queue = new ReportQueue(10, 1000, reportFn)

    queue.push(makeEvent())
    expect(reportFn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000)
    expect(reportFn).toHaveBeenCalledTimes(1)
    queue.destroy()
  })

  it('should not report empty queue', () => {
    const reportFn = vi.fn()
    const queue = new ReportQueue(10, 1000, reportFn)

    vi.advanceTimersByTime(1000)
    expect(reportFn).not.toHaveBeenCalled()
    queue.destroy()
  })

  it('should remove visibilitychange listener on destroy', () => {
    const reportFn = vi.fn()
    const queue = new ReportQueue(10, 5000, reportFn)
    expect(document.addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    queue.destroy()
    expect(document.removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })
})
