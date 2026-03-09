import type { MonitorPlugin, MonitorContext } from '@monit/core'

interface WhiteScreenOptions {
  timeout?: number
  threshold?: number
  minChildCount?: number
}

const SAMPLE_POINTS = [
  [1 / 4, 1 / 4], [2 / 4, 1 / 4], [3 / 4, 1 / 4],
  [1 / 4, 2 / 4], [2 / 4, 2 / 4], [3 / 4, 2 / 4],
  [1 / 4, 3 / 4], [2 / 4, 3 / 4], [3 / 4, 3 / 4],
]

const IGNORE_TAGS = new Set(['HTML', 'BODY', 'SCRIPT', 'STYLE', 'LINK'])

function samplePage(): { validCount: number; totalCount: number } {
  const { innerWidth, innerHeight } = window
  let validCount = 0

  for (const [xRatio, yRatio] of SAMPLE_POINTS) {
    const x = innerWidth * xRatio
    const y = innerHeight * yRatio
    const el = document.elementFromPoint(x, y)
    if (el && !IGNORE_TAGS.has(el.tagName)) {
      validCount++
    }
  }

  return { validCount, totalCount: SAMPLE_POINTS.length }
}

export function createWhiteScreenPlugin(options: WhiteScreenOptions = {}): MonitorPlugin {
  const timeout = options.timeout ?? 5000
  const threshold = options.threshold ?? 0.5
  const minChildCount = options.minChildCount ?? 2

  let observer: MutationObserver | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let hasContent = false

  return {
    name: 'white-screen',
    setup(ctx: MonitorContext) {
      const checkAndReport = () => {
        const { validCount, totalCount } = samplePage()
        const validRatio = validCount / totalCount
        const bodyChildCount = document.body?.childElementCount ?? 0

        if (validRatio < threshold) {
          ctx.report({
            type: 'white-screen',
            subType: 'white-screen',
            payload: {
              validRatio,
              validCount,
              totalCount,
              bodyChildCount,
              timeout,
            },
          })
        }
        cleanup()
      }

      const cleanup = () => {
        observer?.disconnect()
        observer = null
        if (timer) {
          clearTimeout(timer)
          timer = null
        }
      }

      const startDetection = () => {
        observer = new MutationObserver(() => {
          const bodyChildCount = document.body?.childElementCount ?? 0
          if (bodyChildCount >= minChildCount) {
            hasContent = true
            cleanup()
          }
        })

        observer.observe(document.body || document.documentElement, {
          childList: true,
          subtree: true,
        })

        timer = setTimeout(() => {
          if (!hasContent) {
            checkAndReport()
          }
        }, timeout)
      }

      if (document.readyState === 'complete') {
        startDetection()
      } else {
        window.addEventListener('load', startDetection, { once: true })
      }
    },
    teardown() {
      observer?.disconnect()
      observer = null
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    },
  }
}
