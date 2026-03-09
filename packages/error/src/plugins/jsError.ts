import type { MonitorPlugin, MonitorContext } from '@monit/core'

export function createJsErrorPlugin(): MonitorPlugin {
  let handler: OnErrorEventHandler

  return {
    name: 'js-error',
    setup(ctx: MonitorContext) {
      handler = (message, source, lineno, colno, error) => {
        if (!(error instanceof Error) && typeof message !== 'string') return false

        ctx.report({
          type: 'error',
          subType: 'js',
          payload: {
            message: String(message),
            filename: source ?? '',
            lineno: lineno ?? 0,
            colno: colno ?? 0,
            stack: error?.stack ?? '',
          },
        })
        return false
      }
      window.onerror = handler
    },
    teardown() {
      if (window.onerror === handler) {
        window.onerror = null
      }
    },
  }
}
