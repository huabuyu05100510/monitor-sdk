import type { MonitorPlugin, MonitorContext } from '@monit/core'

const RESOURCE_TAGS = new Set(['SCRIPT', 'LINK', 'IMG', 'AUDIO', 'VIDEO'])

export function createResourceErrorPlugin(): MonitorPlugin {
  let handler: (event: Event) => void

  return {
    name: 'resource-error',
    setup(ctx: MonitorContext) {
      handler = (event: Event) => {
        const target = event.target as HTMLElement
        if (!target || !RESOURCE_TAGS.has(target.tagName)) return

        const src =
          (target as HTMLScriptElement).src ||
          (target as HTMLLinkElement).href ||
          (target as HTMLImageElement).src ||
          ''

        ctx.report({
          type: 'error',
          subType: 'resource',
          payload: {
            tagName: target.tagName.toLowerCase(),
            src,
            outerHTML: target.outerHTML.slice(0, 300),
          },
        })
      }
      window.addEventListener('error', handler, true)
    },
    teardown() {
      window.removeEventListener('error', handler, true)
    },
  }
}
