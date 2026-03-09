export type MonitorEventType = 'error' | 'request' | 'white-screen'

export type MonitorEventSubType =
  | 'js'
  | 'promise'
  | 'resource'
  | 'react'
  | 'xhr'
  | 'fetch'
  | 'white-screen'

export interface MonitorEvent {
  appId: string
  type: MonitorEventType
  subType: MonitorEventSubType
  timestamp: number
  url: string
  userAgent: string
  payload: Record<string, unknown>
}

export interface MonitorConfig {
  appId: string
  dsn: string
  maxQueueSize?: number
  flushInterval?: number
  plugins?: MonitorPlugin[]
}

export interface MonitorContext {
  config: Required<MonitorConfig>
  report(event: Omit<MonitorEvent, 'appId' | 'timestamp' | 'url' | 'userAgent'>): void
}

export interface MonitorPlugin {
  name: string
  setup(ctx: MonitorContext): void
  teardown?(): void
}
