import type { MonitorEvent } from '@monit/browser'

type Listener = (events: MonitorEvent[]) => void

const listeners: Listener[] = []

export function onCapturedEvents(fn: Listener): () => void {
  listeners.push(fn)
  return () => {
    const i = listeners.indexOf(fn)
    if (i >= 0) listeners.splice(i, 1)
  }
}

function notifyListeners(events: MonitorEvent[]): void {
  listeners.forEach((fn) => fn(events))
}

function parseEvents(body: string): MonitorEvent[] | null {
  try {
    const parsed = JSON.parse(body)
    if (Array.isArray(parsed?.events)) {
      return parsed.events as MonitorEvent[]
    }
  } catch {
    // ignore parse errors
  }
  return null
}

// Intercept sendBeacon (SDK's primary transport)
const _sendBeacon = navigator.sendBeacon.bind(navigator)
navigator.sendBeacon = (url, data) => {
  if (data instanceof Blob) {
    data.text().then((text) => {
      const events = parseEvents(text)
      if (events) notifyListeners(events)
    })
  } else if (typeof data === 'string') {
    const events = parseEvents(data)
    if (events) notifyListeners(events)
  }
  return _sendBeacon(url, data)
}

// Intercept fetch (SDK's fallback transport)
const _fetch = window.fetch.bind(window)
window.fetch = (input, init) => {
  if (init?.keepalive && typeof init.body === 'string') {
    const events = parseEvents(init.body)
    if (events) notifyListeners(events)
  }
  return _fetch(input, init)
}
