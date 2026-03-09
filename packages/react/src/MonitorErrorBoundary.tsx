import { Component, type ErrorInfo, type ReactNode } from 'react'
import type { MonitorContext } from '@monit/core'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  ctx?: MonitorContext
}

interface State {
  hasError: boolean
}

export class MonitorErrorBoundary extends Component<Props, State> {
  static _ctx: MonitorContext | null = null

  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const ctx = this.props.ctx ?? MonitorErrorBoundary._ctx
    if (!ctx) return

    ctx.report({
      type: 'error',
      subType: 'react',
      payload: {
        message: error.message,
        stack: error.stack ?? '',
        componentStack: errorInfo.componentStack ?? '',
      },
    })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? null
    }
    return this.props.children
  }
}

// 用于 browser 包注入全局 ctx，无需用户手动传 ctx prop
export function setErrorBoundaryContext(ctx: MonitorContext): void {
  MonitorErrorBoundary._ctx = ctx
}
