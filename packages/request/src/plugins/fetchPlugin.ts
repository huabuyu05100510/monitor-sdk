import type { MonitorPlugin, MonitorContext } from '@monit/core'

export function createFetchPlugin(): MonitorPlugin {
  const originalFetch = window.fetch

  return {
    name: 'fetch-request',
    setup(ctx: MonitorContext) {
      window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        const method = (init?.method ?? 'GET').toUpperCase()
        const requestBody =
          typeof init?.body === 'string' ? init.body.slice(0, 500) : ''
        const start = Date.now()

        try {
          const response = await originalFetch(input, init)
          const duration = Date.now() - start

          if (!response.ok) {
            const cloned = response.clone()
            const responseText = await cloned.text().catch(() => '')
            ctx.report({
              type: 'request',
              subType: 'fetch',
              payload: {
                method,
                url,
                status: response.status,
                duration,
                requestBody,
                responseText: responseText.slice(0, 500),
              },
            })
          }
          return response
        } catch (error) {
          const duration = Date.now() - start
          ctx.report({
            type: 'request',
            subType: 'fetch',
            payload: {
              method,
              url,
              status: 0,
              duration,
              requestBody,
              responseText: error instanceof Error ? error.message : String(error),
            },
          })
          throw error
        }
      }
    },
    teardown() {
      window.fetch = originalFetch
    },
  }
}
