import type { MonitorPlugin, MonitorContext } from '@monit/core'

interface XhrMeta {
  method: string
  url: string
  start: number
  body: string
}

// WeakMap 存储 XHR 元数据，避免污染 XMLHttpRequest 实例
const xhrMetaMap = new WeakMap<XMLHttpRequest, XhrMeta>()

export function createXhrPlugin(): MonitorPlugin {
  const originalOpen = XMLHttpRequest.prototype.open
  const originalSend = XMLHttpRequest.prototype.send

  return {
    name: 'xhr-request',
    setup(ctx: MonitorContext) {
      XMLHttpRequest.prototype.open = function (method: string, url: string, ...rest: unknown[]) {
        xhrMetaMap.set(this, {
          method: method.toUpperCase(),
          url: String(url),
          start: Date.now(),
          body: '',
        })
        return (originalOpen as (...args: unknown[]) => void).apply(this, [method, url, ...rest])
      }

      XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
        const meta = xhrMetaMap.get(this)
        if (meta) {
          meta.body = typeof body === 'string' ? body.slice(0, 500) : ''
        }

        this.addEventListener('loadend', () => {
          const status: number = this.status
          const m = xhrMetaMap.get(this)
          const duration = m ? Date.now() - m.start : 0

          if (status === 0 || status >= 400) {
            ctx.report({
              type: 'request',
              subType: 'xhr',
              payload: {
                method: m?.method ?? 'GET',
                url: m?.url ?? '',
                status,
                duration,
                requestBody: m?.body ?? '',
                responseText: this.responseText?.slice(0, 500) ?? '',
              },
            })
          }
          xhrMetaMap.delete(this)
        })

        return (originalSend as (body?: Document | XMLHttpRequestBodyInit | null) => void).apply(this, [body])
      }
    },
    teardown() {
      XMLHttpRequest.prototype.open = originalOpen
      XMLHttpRequest.prototype.send = originalSend
    },
  }
}
