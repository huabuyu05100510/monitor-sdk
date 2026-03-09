import type { MonitorEvent } from './types'

export function sendEvents(dsn: string, events: MonitorEvent[]): void {
  const body = JSON.stringify({ events })

  // 优先 sendBeacon（页面关闭不丢数据）
  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' })
    const sent = navigator.sendBeacon(dsn, blob)
    if (sent) return
  }

  // 降级 fetch
  fetch(dsn, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // 静默失败，监控 SDK 不应影响业务
  })
}
