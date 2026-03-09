# Monitor SDK Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建基于 pnpm + Monorepo + tsup 的前端监控 SDK，支持 JS 错误、Promise 错误、资源错误、React 错误、请求错误、白屏检测，ESM/CJS/UMD 三种格式发布。

**Architecture:** 插件化架构，`@monit/core` 提供插件注册、上报队列、配置管理；各采集能力作为独立插件包；`@monit/browser` 作为组装入口对外发布。数据流：采集器 → 标准化事件 → 上报队列 → HTTP 上报。

**Tech Stack:** pnpm workspaces, TypeScript, tsup, changesets, vitest

---

## Task 1: 初始化 Monorepo 工程结构

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.npmrc`
- Create: `.gitignore`

**Step 1: 创建根目录 package.json**

```json
{
  "name": "monitor-sdk",
  "private": true,
  "scripts": {
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "dev": "pnpm -r run dev",
    "changeset": "changeset",
    "version": "changeset version",
    "release": "pnpm build && changeset publish"
  },
  "devDependencies": {
    "@changesets/cli": "^2.27.0",
    "typescript": "^5.4.0",
    "tsup": "^8.0.0",
    "vitest": "^1.5.0"
  }
}
```

**Step 2: 创建 pnpm-workspace.yaml**

```yaml
packages:
  - 'packages/*'
```

**Step 3: 创建 tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2015",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "lib": ["ES2015", "DOM", "DOM.Iterable"],
    "skipLibCheck": true
  }
}
```

**Step 4: 创建 .npmrc**

```
shamefully-hoist=false
strict-peer-dependencies=false
```

**Step 5: 创建 .gitignore**

```
node_modules
dist
*.d.ts
*.d.ts.map
*.js.map
.DS_Store
```

**Step 6: 安装根依赖**

```bash
cd /Users/didi/Documents/code/monitor-sdk
pnpm install
```

**Step 7: 初始化 git 并提交**

```bash
git init
git add .
git commit -m "chore: init monorepo workspace"
```

---

## Task 2: 创建 `@monit/core` 包

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/tsup.config.ts`
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/monitor.ts`
- Create: `packages/core/src/queue.ts`
- Create: `packages/core/src/reporter.ts`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/src/__tests__/queue.test.ts`

**Step 1: 创建 packages/core/package.json**

```json
{
  "name": "@monit/core",
  "version": "0.1.0",
  "description": "Frontend monitor SDK core",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.5.0"
  }
}
```

**Step 2: 创建 packages/core/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 3: 创建 packages/core/tsup.config.ts**

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
})
```

**Step 4: 创建 packages/core/src/types.ts**

```ts
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
```

**Step 5: 创建 packages/core/src/queue.ts**

```ts
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
```

**Step 6: 创建 packages/core/src/reporter.ts**

```ts
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
```

**Step 7: 创建 packages/core/src/monitor.ts**

```ts
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
```

**Step 8: 创建 packages/core/src/index.ts**

```ts
export { Monitor } from './monitor'
export type { MonitorConfig, MonitorContext, MonitorEvent, MonitorPlugin, MonitorEventType, MonitorEventSubType } from './types'
```

**Step 9: 写 queue 单元测试**

创建 `packages/core/src/__tests__/queue.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ReportQueue } from '../queue'

// mock document.addEventListener
Object.defineProperty(document, 'addEventListener', {
  value: vi.fn(),
  writable: true,
})

describe('ReportQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should flush when queue reaches maxSize', () => {
    const reportFn = vi.fn()
    const queue = new ReportQueue(3, 5000, reportFn)

    queue.push({ appId: 'test' } as any)
    queue.push({ appId: 'test' } as any)
    expect(reportFn).not.toHaveBeenCalled()

    queue.push({ appId: 'test' } as any)
    expect(reportFn).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ appId: 'test' })]))
    queue.destroy()
  })

  it('should flush on timer interval', () => {
    const reportFn = vi.fn()
    const queue = new ReportQueue(10, 1000, reportFn)

    queue.push({ appId: 'test' } as any)
    expect(reportFn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000)
    expect(reportFn).toHaveBeenCalledTimes(1)
    queue.destroy()
  })

  it('should not report empty queue', () => {
    const reportFn = vi.fn()
    const queue = new ReportQueue(10, 1000, reportFn)

    vi.advanceTimersByTime(1000)
    expect(reportFn).not.toHaveBeenCalled()
    queue.destroy()
  })
})
```

**Step 10: 安装依赖并验证构建**

```bash
cd /Users/didi/Documents/code/monitor-sdk
pnpm install
cd packages/core && pnpm test
```

Expected: 3 tests PASS

```bash
pnpm build
```

Expected: `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` 生成成功

**Step 11: 提交**

```bash
cd /Users/didi/Documents/code/monitor-sdk
git add packages/core
git commit -m "feat(core): add plugin system, report queue and reporter"
```

---

## Task 3: 创建 `@monit/error` 包

**Files:**
- Create: `packages/error/package.json`
- Create: `packages/error/tsconfig.json`
- Create: `packages/error/tsup.config.ts`
- Create: `packages/error/src/plugins/jsError.ts`
- Create: `packages/error/src/plugins/promiseError.ts`
- Create: `packages/error/src/plugins/resourceError.ts`
- Create: `packages/error/src/index.ts`
- Create: `packages/error/src/__tests__/jsError.test.ts`

**Step 1: 创建 packages/error/package.json**

```json
{
  "name": "@monit/error",
  "version": "0.1.0",
  "description": "Frontend monitor error plugin",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run"
  },
  "dependencies": {
    "@monit/core": "workspace:*"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.5.0"
  }
}
```

**Step 2: 创建 packages/error/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 3: 创建 packages/error/tsup.config.ts**

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['@monit/core'],
})
```

**Step 4: 创建 packages/error/src/plugins/jsError.ts**

```ts
import type { MonitorPlugin, MonitorContext } from '@monit/core'

export function createJsErrorPlugin(): MonitorPlugin {
  let handler: OnErrorEventHandler

  return {
    name: 'js-error',
    setup(ctx: MonitorContext) {
      handler = (message, source, lineno, colno, error) => {
        // 过滤资源加载错误（由 resourceError 插件处理）
        if (!(error instanceof Error) && typeof message !== 'string') return false

        ctx.report({
          type: 'error',
          subType: 'js',
          payload: {
            message: String(message),
            filename: source ?? '',
            lineno: lineno ?? 0,
            colno: colno ?? 0,
            stack: error?.stack ?? '',
          },
        })
        return false // 不阻止浏览器默认错误处理
      }
      window.onerror = handler
    },
    teardown() {
      if (window.onerror === handler) {
        window.onerror = null
      }
    },
  }
}
```

**Step 5: 创建 packages/error/src/plugins/promiseError.ts**

```ts
import type { MonitorPlugin, MonitorContext } from '@monit/core'

export function createPromiseErrorPlugin(): MonitorPlugin {
  let handler: (event: PromiseRejectionEvent) => void

  return {
    name: 'promise-error',
    setup(ctx: MonitorContext) {
      handler = (event: PromiseRejectionEvent) => {
        const reason = event.reason
        ctx.report({
          type: 'error',
          subType: 'promise',
          payload: {
            message: reason instanceof Error ? reason.message : String(reason),
            stack: reason instanceof Error ? (reason.stack ?? '') : '',
            reason: String(reason),
          },
        })
      }
      window.addEventListener('unhandledrejection', handler)
    },
    teardown() {
      window.removeEventListener('unhandledrejection', handler)
    },
  }
}
```

**Step 6: 创建 packages/error/src/plugins/resourceError.ts**

```ts
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
            outerHTML: target.outerHTML.slice(0, 300), // 截断避免过大
          },
        })
      }
      // 使用捕获阶段，资源错误不冒泡
      window.addEventListener('error', handler, true)
    },
    teardown() {
      window.removeEventListener('error', handler, true)
    },
  }
}
```

**Step 7: 创建 packages/error/src/index.ts**

```ts
export { createJsErrorPlugin } from './plugins/jsError'
export { createPromiseErrorPlugin } from './plugins/promiseError'
export { createResourceErrorPlugin } from './plugins/resourceError'

// 组合插件：一次注册所有错误类型
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
```

**Step 8: 写单元测试**

创建 `packages/error/src/__tests__/jsError.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createJsErrorPlugin } from '../plugins/jsError'
import type { MonitorContext } from '@monit/core'

function createMockCtx(): MonitorContext {
  return {
    config: { appId: 'test', dsn: 'http://test', maxQueueSize: 10, flushInterval: 5000, plugins: [] },
    report: vi.fn(),
  }
}

describe('jsErrorPlugin', () => {
  afterEach(() => {
    window.onerror = null
  })

  it('should report js error', () => {
    const ctx = createMockCtx()
    const plugin = createJsErrorPlugin()
    plugin.setup(ctx)

    const error = new Error('test error')
    window.onerror?.('test error', 'test.js', 10, 5, error)

    expect(ctx.report).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        subType: 'js',
        payload: expect.objectContaining({
          message: 'test error',
          filename: 'test.js',
          lineno: 10,
          colno: 5,
        }),
      }),
    )
  })

  it('should remove handler on teardown', () => {
    const ctx = createMockCtx()
    const plugin = createJsErrorPlugin()
    plugin.setup(ctx)
    plugin.teardown?.()
    expect(window.onerror).toBeNull()
  })
})
```

**Step 9: 安装依赖并验证**

```bash
cd /Users/didi/Documents/code/monitor-sdk
pnpm install
cd packages/error && pnpm test
```

Expected: tests PASS

```bash
pnpm build
```

**Step 10: 提交**

```bash
cd /Users/didi/Documents/code/monitor-sdk
git add packages/error
git commit -m "feat(error): add js/promise/resource error plugins"
```

---

## Task 4: 创建 `@monit/request` 包

**Files:**
- Create: `packages/request/package.json`
- Create: `packages/request/tsconfig.json`
- Create: `packages/request/tsup.config.ts`
- Create: `packages/request/src/plugins/xhrPlugin.ts`
- Create: `packages/request/src/plugins/fetchPlugin.ts`
- Create: `packages/request/src/index.ts`
- Create: `packages/request/src/__tests__/fetchPlugin.test.ts`

**Step 1: 创建 packages/request/package.json**

```json
{
  "name": "@monit/request",
  "version": "0.1.0",
  "description": "Frontend monitor request error plugin",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run"
  },
  "dependencies": {
    "@monit/core": "workspace:*"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.5.0"
  }
}
```

**Step 2: tsconfig.json 与 tsup.config.ts（同 error 包结构）**

`packages/request/tsconfig.json` 同 error 包。

`packages/request/tsup.config.ts` 同 error 包，`external: ['@monit/core']`。

**Step 3: 创建 packages/request/src/plugins/xhrPlugin.ts**

```ts
import type { MonitorPlugin, MonitorContext } from '@monit/core'

export function createXhrPlugin(): MonitorPlugin {
  const originalOpen = XMLHttpRequest.prototype.open
  const originalSend = XMLHttpRequest.prototype.send

  return {
    name: 'xhr-request',
    setup(ctx: MonitorContext) {
      XMLHttpRequest.prototype.open = function (method: string, url: string, ...rest: any[]) {
        this.__monitor_method__ = method.toUpperCase()
        this.__monitor_url__ = url
        this.__monitor_start__ = Date.now()
        return originalOpen.apply(this, [method, url, ...rest] as any)
      }

      XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
        this.__monitor_body__ = typeof body === 'string' ? body.slice(0, 500) : ''

        this.addEventListener('loadend', () => {
          const status: number = this.status
          const duration = Date.now() - (this.__monitor_start__ ?? Date.now())

          if (status === 0 || status >= 400) {
            ctx.report({
              type: 'request',
              subType: 'xhr',
              payload: {
                method: this.__monitor_method__ ?? 'GET',
                url: this.__monitor_url__ ?? '',
                status,
                duration,
                requestBody: this.__monitor_body__ ?? '',
                responseText: this.responseText?.slice(0, 500) ?? '',
              },
            })
          }
        })

        return originalSend.apply(this, [body] as any)
      }
    },
    teardown() {
      XMLHttpRequest.prototype.open = originalOpen
      XMLHttpRequest.prototype.send = originalSend
    },
  }
}
```

**Step 4: 创建 packages/request/src/plugins/fetchPlugin.ts**

```ts
import type { MonitorPlugin, MonitorContext } from '@monit/core'

export function createFetchPlugin(): MonitorPlugin {
  const originalFetch = window.fetch

  return {
    name: 'fetch-request',
    setup(ctx: MonitorContext) {
      window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        const method = (init?.method ?? 'GET').toUpperCase()
        const requestBody =
          typeof init?.body === 'string' ? init.body.slice(0, 500) : ''
        const start = Date.now()

        try {
          const response = await originalFetch(input, init)
          const duration = Date.now() - start

          if (!response.ok) {
            // clone 避免消费 body stream
            const cloned = response.clone()
            const responseText = await cloned.text().catch(() => '')
            ctx.report({
              type: 'request',
              subType: 'fetch',
              payload: {
                method,
                url,
                status: response.status,
                duration,
                requestBody,
                responseText: responseText.slice(0, 500),
              },
            })
          }
          return response
        } catch (error) {
          const duration = Date.now() - start
          ctx.report({
            type: 'request',
            subType: 'fetch',
            payload: {
              method,
              url,
              status: 0,
              duration,
              requestBody,
              responseText: error instanceof Error ? error.message : String(error),
            },
          })
          throw error
        }
      }
    },
    teardown() {
      window.fetch = originalFetch
    },
  }
}
```

**Step 5: 创建 packages/request/src/index.ts**

```ts
export { createXhrPlugin } from './plugins/xhrPlugin'
export { createFetchPlugin } from './plugins/fetchPlugin'

import { createXhrPlugin } from './plugins/xhrPlugin'
import { createFetchPlugin } from './plugins/fetchPlugin'
import type { MonitorPlugin } from '@monit/core'

export function createRequestPlugins(): MonitorPlugin[] {
  return [createXhrPlugin(), createFetchPlugin()]
}
```

**Step 6: 写 fetch 插件测试**

创建 `packages/request/src/__tests__/fetchPlugin.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createFetchPlugin } from '../plugins/fetchPlugin'
import type { MonitorContext } from '@monit/core'

function createMockCtx(): MonitorContext {
  return {
    config: { appId: 'test', dsn: 'http://test', maxQueueSize: 10, flushInterval: 5000, plugins: [] },
    report: vi.fn(),
  }
}

describe('fetchPlugin', () => {
  const originalFetch = window.fetch
  let plugin: ReturnType<typeof createFetchPlugin>

  beforeEach(() => {
    plugin = createFetchPlugin()
  })

  afterEach(() => {
    plugin.teardown?.()
    window.fetch = originalFetch
  })

  it('should report fetch error on 4xx response', async () => {
    const ctx = createMockCtx()
    window.fetch = vi.fn().mockResolvedValue(
      new Response('Not Found', { status: 404 }),
    )

    plugin.setup(ctx)
    await window.fetch('https://api.example.com/test')

    expect(ctx.report).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'request',
        subType: 'fetch',
        payload: expect.objectContaining({ status: 404, url: 'https://api.example.com/test' }),
      }),
    )
  })

  it('should not report on 2xx response', async () => {
    const ctx = createMockCtx()
    window.fetch = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))

    plugin.setup(ctx)
    await window.fetch('https://api.example.com/test')

    expect(ctx.report).not.toHaveBeenCalled()
  })

  it('should report on network error', async () => {
    const ctx = createMockCtx()
    window.fetch = vi.fn().mockRejectedValue(new Error('Network Error'))

    plugin.setup(ctx)
    await window.fetch('https://api.example.com/test').catch(() => {})

    expect(ctx.report).toHaveBeenCalledWith(
      expect.objectContaining({
        subType: 'fetch',
        payload: expect.objectContaining({ status: 0 }),
      }),
    )
  })
})
```

**Step 7: 验证构建和测试**

```bash
cd /Users/didi/Documents/code/monitor-sdk
pnpm install
cd packages/request && pnpm test && pnpm build
```

**Step 8: 提交**

```bash
cd /Users/didi/Documents/code/monitor-sdk
git add packages/request
git commit -m "feat(request): add xhr/fetch request error plugins"
```

---

## Task 5: 创建 `@monit/white-screen` 包

**Files:**
- Create: `packages/white-screen/package.json`
- Create: `packages/white-screen/tsconfig.json`
- Create: `packages/white-screen/tsup.config.ts`
- Create: `packages/white-screen/src/plugins/whiteScreen.ts`
- Create: `packages/white-screen/src/index.ts`

**Step 1: 创建 packages/white-screen/package.json**

```json
{
  "name": "@monit/white-screen",
  "version": "0.1.0",
  "description": "Frontend monitor white screen detection plugin",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run"
  },
  "dependencies": {
    "@monit/core": "workspace:*"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.5.0"
  }
}
```

**Step 2: 创建 packages/white-screen/src/plugins/whiteScreen.ts**

```ts
import type { MonitorPlugin, MonitorContext } from '@monit/core'

interface WhiteScreenOptions {
  timeout?: number      // 判定白屏的等待时间(ms)，默认 5000
  threshold?: number    // 有效节点占比阈值，默认 0.5
  minChildCount?: number // body 直接子节点最小数量，默认 2
}

// 9宫格采样点（相对页面宽高的比例）
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
        // MutationObserver 监听 DOM 变化
        observer = new MutationObserver(() => {
          const bodyChildCount = document.body?.childElementCount ?? 0
          if (bodyChildCount >= minChildCount) {
            hasContent = true
            cleanup() // 有内容，停止检测
          }
        })

        observer.observe(document.body || document.documentElement, {
          childList: true,
          subtree: true,
        })

        // 超时后兜底采样
        timer = setTimeout(() => {
          if (!hasContent) {
            checkAndReport()
          }
        }, timeout)
      }

      // 页面加载完后开始检测
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
```

**Step 3: 创建 packages/white-screen/src/index.ts**

```ts
export { createWhiteScreenPlugin } from './plugins/whiteScreen'
```

**Step 4: 构建验证**

```bash
cd /Users/didi/Documents/code/monitor-sdk
pnpm install
cd packages/white-screen && pnpm build
```

Expected: dist 生成成功

**Step 5: 提交**

```bash
cd /Users/didi/Documents/code/monitor-sdk
git add packages/white-screen
git commit -m "feat(white-screen): add white screen detection plugin"
```

---

## Task 6: 创建 `@monit/react` 包

**Files:**
- Create: `packages/react/package.json`
- Create: `packages/react/tsconfig.json`
- Create: `packages/react/tsup.config.ts`
- Create: `packages/react/src/MonitorErrorBoundary.tsx`
- Create: `packages/react/src/index.ts`

**Step 1: 创建 packages/react/package.json**

```json
{
  "name": "@monit/react",
  "version": "0.1.0",
  "description": "Frontend monitor React error boundary plugin",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run"
  },
  "dependencies": {
    "@monit/core": "workspace:*"
  },
  "peerDependencies": {
    "react": ">=16.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.0.0",
    "react": "^18.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.5.0"
  }
}
```

**Step 2: 创建 packages/react/tsup.config.ts**

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['@monit/core', 'react'],
  jsx: 'react',
})
```

**Step 3: 创建 packages/react/src/MonitorErrorBoundary.tsx**

```tsx
import React, { Component, ErrorInfo, ReactNode } from 'react'
import type { MonitorContext } from '@monit/core'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  ctx?: MonitorContext
}

interface State {
  hasError: boolean
}

export class MonitorErrorBoundary extends Component<Props, State> {
  static _ctx: MonitorContext | null = null

  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const ctx = this.props.ctx ?? MonitorErrorBoundary._ctx
    if (!ctx) return

    ctx.report({
      type: 'error',
      subType: 'react',
      payload: {
        message: error.message,
        stack: error.stack ?? '',
        componentStack: errorInfo.componentStack ?? '',
      },
    })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? null
    }
    return this.props.children
  }
}

// 用于 browser 包注入全局 ctx，无需用户手动传 ctx prop
export function setErrorBoundaryContext(ctx: MonitorContext): void {
  MonitorErrorBoundary._ctx = ctx
}
```

**Step 4: 创建 packages/react/src/index.ts**

```ts
export { MonitorErrorBoundary, setErrorBoundaryContext } from './MonitorErrorBoundary'
```

**Step 5: 构建验证**

```bash
cd /Users/didi/Documents/code/monitor-sdk
pnpm install
cd packages/react && pnpm build
```

**Step 6: 提交**

```bash
cd /Users/didi/Documents/code/monitor-sdk
git add packages/react
git commit -m "feat(react): add MonitorErrorBoundary component"
```

---

## Task 7: 创建 `@monit/browser` 组装入口包

**Files:**
- Create: `packages/browser/package.json`
- Create: `packages/browser/tsconfig.json`
- Create: `packages/browser/tsup.config.ts`
- Create: `packages/browser/src/index.ts`

**Step 1: 创建 packages/browser/package.json**

```json
{
  "name": "@monit/browser",
  "version": "0.1.0",
  "description": "Frontend monitor SDK browser entry",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run"
  },
  "dependencies": {
    "@monit/core": "workspace:*",
    "@monit/error": "workspace:*",
    "@monit/request": "workspace:*",
    "@monit/white-screen": "workspace:*"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.5.0"
  }
}
```

**Step 2: 创建 packages/browser/tsup.config.ts**

```ts
import { defineConfig } from 'tsup'

export default defineConfig([
  // ESM + CJS
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
  },
  // UMD (iife) for script tag
  {
    entry: ['src/index.ts'],
    format: ['iife'],
    globalName: 'Monitor',
    outExtension: () => ({ js: '.umd.js' }),
    sourcemap: true,
    minify: true,
  },
])
```

**Step 3: 创建 packages/browser/src/index.ts**

```ts
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
```

**Step 4: 构建验证**

```bash
cd /Users/didi/Documents/code/monitor-sdk
pnpm install
# 先构建所有依赖包
pnpm --filter @monit/core build
pnpm --filter @monit/error build
pnpm --filter @monit/request build
pnpm --filter @monit/white-screen build
# 再构建 browser
pnpm --filter @monit/browser build
```

Expected:
- `packages/browser/dist/index.js` (ESM)
- `packages/browser/dist/index.cjs` (CJS)
- `packages/browser/dist/index.umd.js` (UMD，压缩)
- `packages/browser/dist/index.d.ts`

**Step 5: 提交**

```bash
cd /Users/didi/Documents/code/monitor-sdk
git add packages/browser
git commit -m "feat(browser): add browser entry with esm/cjs/umd output"
```

---

## Task 8: 配置 changesets 并准备发布

**Files:**
- Create: `.changeset/config.json`
- Modify: 根 `package.json` 确认 release 脚本

**Step 1: 初始化 changesets**

```bash
cd /Users/didi/Documents/code/monitor-sdk
pnpm changeset init
```

**Step 2: 修改 .changeset/config.json**

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

注意 `"access": "public"` — scoped 包必须显式设为 public 才能免费发布到 npm。

**Step 3: 创建初始 changeset**

```bash
pnpm changeset
# 选择所有包，选择 minor，输入描述：Initial release
```

**Step 4: 应用版本号**

```bash
pnpm changeset version
```

**Step 5: 验证全量构建**

```bash
cd /Users/didi/Documents/code/monitor-sdk
pnpm build
```

Expected: 所有包 dist 生成成功，无报错

**Step 6: 提交**

```bash
git add .
git commit -m "chore: setup changesets and bump versions to 0.1.0"
```

---

## Task 9: 发布到 npm

**Step 1: 登录 npm**

```bash
npm login
# 输入账号、密码、邮箱、OTP
```

**Step 2: 发布所有包**

```bash
cd /Users/didi/Documents/code/monitor-sdk
pnpm release
# 等价于: pnpm build && changeset publish
```

Expected: 每个包显示 `+ @monit/xxx@0.1.0`

**Step 3: 验证发布成功**

```bash
npm info @monit/browser
```

Expected: 返回包信息

---

## 完成后接入示例

### NPM 方式
```ts
// main.ts / app.ts（应用最顶部）
import { init } from '@monit/browser'

init({
  appId: 'your-unique-app-id',
  dsn: 'https://your-api/report',
})
```

### Script 标签方式
```html
<head>
  <script src="https://cdn.xxx/monitor.umd.js"></script>
  <script>
    Monitor.init({
      appId: 'your-unique-app-id',
      dsn: 'https://your-api/report'
    })
  </script>
</head>
```

### React 项目额外接入
```bash
npm install @monit/react
```
```tsx
import { MonitorErrorBoundary } from '@monit/react'

root.render(
  <MonitorErrorBoundary fallback={<div>页面出错了</div>}>
    <App />
  </MonitorErrorBoundary>
)
```
