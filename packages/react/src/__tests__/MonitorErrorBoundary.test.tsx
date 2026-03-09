import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { MonitorErrorBoundary, setErrorBoundaryContext } from '../MonitorErrorBoundary'
import type { MonitorContext } from '@monit/core'

function createMockCtx(): MonitorContext {
  return {
    config: { appId: 'test', dsn: 'http://test', maxQueueSize: 10, flushInterval: 5000, plugins: [] },
    report: vi.fn(),
  }
}

// 抛出错误的测试组件
function ThrowError({ message }: { message: string }): React.ReactElement {
  throw new Error(message)
}

// 静默 React 错误边界的 console.error 输出
const originalConsoleError = console.error
beforeEach(() => {
  console.error = vi.fn()
  MonitorErrorBoundary._ctx = null
})

afterEach(() => {
  console.error = originalConsoleError
})

describe('MonitorErrorBoundary', () => {
  it('should catch error and report via ctx prop', () => {
    const ctx = createMockCtx()

    render(
      <MonitorErrorBoundary ctx={ctx} fallback={<div>Error</div>}>
        <ThrowError message="test component error" />
      </MonitorErrorBoundary>,
    )

    expect(ctx.report).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        subType: 'react',
        payload: expect.objectContaining({
          message: 'test component error',
        }),
      }),
    )
  })

  it('should catch error and report via global ctx', () => {
    const ctx = createMockCtx()
    setErrorBoundaryContext(ctx)

    render(
      <MonitorErrorBoundary fallback={<div>Error</div>}>
        <ThrowError message="global ctx error" />
      </MonitorErrorBoundary>,
    )

    expect(ctx.report).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        subType: 'react',
        payload: expect.objectContaining({
          message: 'global ctx error',
        }),
      }),
    )
  })

  it('should render fallback UI on error', () => {
    const ctx = createMockCtx()
    const { getByText } = render(
      <MonitorErrorBoundary ctx={ctx} fallback={<div>Fallback UI</div>}>
        <ThrowError message="crash" />
      </MonitorErrorBoundary>,
    )

    expect(getByText('Fallback UI')).toBeTruthy()
  })

  it('should render children when no error', () => {
    const ctx = createMockCtx()
    const { getByText } = render(
      <MonitorErrorBoundary ctx={ctx}>
        <div>Normal Content</div>
      </MonitorErrorBoundary>,
    )

    expect(getByText('Normal Content')).toBeTruthy()
    expect(ctx.report).not.toHaveBeenCalled()
  })
})
