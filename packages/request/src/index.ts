export { createXhrPlugin } from './plugins/xhrPlugin'
export { createFetchPlugin } from './plugins/fetchPlugin'

import { createXhrPlugin } from './plugins/xhrPlugin'
import { createFetchPlugin } from './plugins/fetchPlugin'
import type { MonitorPlugin } from '@monit/core'

export function createRequestPlugins(): MonitorPlugin[] {
  return [createXhrPlugin(), createFetchPlugin()]
}
