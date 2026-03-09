import type { MonitorPlugin, MonitorContext } from '@monit/core'

export function createPromiseErrorPlugin(): MonitorPlugin {
  let handler: (event: PromiseRejectionEvent) => void

  return {
    name: 'promise-error',
    setup(ctx: MonitorContext) {
      handler = (event: PromiseRejectionEvent) => {
        const reason = event.reason
        ctx.report({
          type: 'error',
          subType: 'promise',
          payload: {
            message: reason instanceof Error ? reason.message : String(reason),
            stack: reason instanceof Error ? (reason.stack ?? '') : '',
            reason: String(reason),
          },
        })
      }
      window.addEventListener('unhandledrejection', handler)
    },
    teardown() {
      window.removeEventListener('unhandledrejection', handler)
    },
  }
}
