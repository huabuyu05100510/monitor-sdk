import type { MonitorConfig, MonitorContext, MonitorEvent, MonitorPlugin } from './types'
import { ReportQueue } from './queue'
import { sendEvents } from './reporter'

const DEFAULT_CONFIG = {
  maxQueueSize: 10,
  flushInterval: 5000,
  plugins: [] as MonitorPlugin[],
}

export class Monitor {
  private config: Required<MonitorConfig>
  private queue: ReportQueue
  private plugins: MonitorPlugin[] = []
  private initialized = false

  constructor(config: MonitorConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.queue = new ReportQueue(
      this.config.maxQueueSize,
      this.config.flushInterval,
      (events) => sendEvents(this.config.dsn, events),
    )
  }

  init(): void {
    if (this.initialized) return
    this.initialized = true

    const ctx = this.createContext()
    for (const plugin of this.config.plugins) {
      this.use(plugin, ctx)
    }
  }

  use(plugin: MonitorPlugin, ctx?: MonitorContext): void {
    if (this.plugins.find((p) => p.name === plugin.name)) return
    this.plugins.push(plugin)
    plugin.setup(ctx ?? this.createContext())
  }

  destroy(): void {
    for (const plugin of this.plugins) {
      plugin.teardown?.()
    }
    this.plugins = []
    this.queue.destroy()
    this.initialized = false
  }

  private createContext(): MonitorContext {
    return {
      config: this.config,
      report: (partial) => {
        const event: MonitorEvent = {
          appId: this.config.appId,
          timestamp: Date.now(),
          url: location.href,
          userAgent: navigator.userAgent,
          ...partial,
        }
        this.queue.push(event)
      },
    }
  }
}
