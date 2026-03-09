import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ReportQueue } from '../queue'

// mock document.addEventListener
Object.defineProperty(document, 'addEventListener', {
  value: vi.fn(),
  writable: true,
})

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

    queue.push({ appId: 'test' } as any)
    queue.push({ appId: 'test' } as any)
    expect(reportFn).not.toHaveBeenCalled()

    queue.push({ appId: 'test' } as any)
    expect(reportFn).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ appId: 'test' })]))
    queue.destroy()
  })

  it('should flush on timer interval', () => {
    const reportFn = vi.fn()
    const queue = new ReportQueue(10, 1000, reportFn)

    queue.push({ appId: 'test' } as any)
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
})
