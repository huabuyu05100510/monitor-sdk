import type { MonitorEvent } from './types'

type ReportFn = (events: MonitorEvent[]) => void

export class ReportQueue {
  private queue: MonitorEvent[] = []
  private timer: ReturnType<typeof setInterval> | null = null
  private readonly maxSize: number
  private readonly interval: number
  private readonly reportFn: ReportFn

  constructor(maxSize: number, interval: number, reportFn: ReportFn) {
    this.maxSize = maxSize
    this.interval = interval
    this.reportFn = reportFn
    this.startTimer()
    this.bindVisibilityChange()
  }

  push(event: MonitorEvent): void {
    this.queue.push(event)
    if (this.queue.length >= this.maxSize) {
      this.flush()
    }
  }

  flush(): void {
    if (this.queue.length === 0) return
    const events = this.queue.splice(0)
    this.reportFn(events)
  }

  destroy(): void {
    this.flush()
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private startTimer(): void {
    this.timer = setInterval(() => this.flush(), this.interval)
  }

  private bindVisibilityChange(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush()
      }
    })
  }
}
