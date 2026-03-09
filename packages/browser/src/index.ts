import { Monitor } from '@monit/core'
import { createErrorPlugins } from '@monit/error'
import { createRequestPlugins } from '@monit/request'
import { createWhiteScreenPlugin } from '@monit/white-screen'
import type { MonitorConfig } from '@monit/core'

export type { MonitorConfig, MonitorPlugin, MonitorEvent } from '@monit/core'

let instance: Monitor | null = null

export function init(config: MonitorConfig): Monitor {
  if (instance) {
    instance.destroy()
  }

  const plugins = [
    ...createErrorPlugins(),
    ...createRequestPlugins(),
    createWhiteScreenPlugin(),
    ...(config.plugins ?? []),
  ]

  instance = new Monitor({ ...config, plugins })
  instance.init()

  return instance
}

export function getMonitor(): Monitor | null {
  return instance
}

export { Monitor }
