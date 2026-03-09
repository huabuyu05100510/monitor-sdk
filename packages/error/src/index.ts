export { createJsErrorPlugin } from './plugins/jsError'
export { createPromiseErrorPlugin } from './plugins/promiseError'
export { createResourceErrorPlugin } from './plugins/resourceError'

import { createJsErrorPlugin } from './plugins/jsError'
import { createPromiseErrorPlugin } from './plugins/promiseError'
import { createResourceErrorPlugin } from './plugins/resourceError'
import type { MonitorPlugin } from '@monit/core'

export function createErrorPlugins(): MonitorPlugin[] {
  return [
    createJsErrorPlugin(),
    createPromiseErrorPlugin(),
    createResourceErrorPlugin(),
  ]
}
