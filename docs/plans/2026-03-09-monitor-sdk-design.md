# Monitor SDK 设计文档

**日期：** 2026-03-09
**状态：** 已批准

---

## 概述

基于 pnpm + Monorepo + tsup 构建的前端监控 SDK，支持 ESM/CJS/UMD 三种格式，实现无感知接入。首期实现错误监控，架构可扩展以支持后续性能监控、行为录制等能力。

---

## 整体架构

### 插件化设计

核心 `Monitor` 类提供插件注册机制，所有采集能力均以插件形式挂载，解耦核心与业务逻辑。

```
采集器(Plugin) → 标准化事件(MonitorEvent) → 上报队列(Queue) → HTTP上报(Reporter)
```

### 接入方式

**NPM 包：**
```ts
import { init } from '@monit/browser'
init({ appId: 'your-app-id', dsn: 'https://your-api/report' })
```

**Script 标签（UMD）：**
```html
<script src="https://cdn.xxx/monitor.umd.js"></script>
<script>Monitor.init({ appId: 'your-app-id', dsn: 'https://your-api/report' })</script>
```

**React 项目额外接入：**
```tsx
import { MonitorErrorBoundary } from '@monit/react'
<MonitorErrorBoundary>
  <App />
</MonitorErrorBoundary>
```

---

## 包结构

```
monitor-sdk/
├── package.json              # pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json        # 共享 TS 配置
├── packages/
│   ├── core/                 # 插件系统 + 上报队列 + 配置管理
│   ├── error/                # JS + Promise未处理拒绝 + 资源错误
│   ├── react/                # React ErrorBoundary 插件
│   ├── request/              # XHR/Fetch 请求错误
│   ├── white-screen/         # 白屏检测
│   └── browser/              # 组装入口，对外统一发布
└── docs/plans/
```

### 包间依赖关系

```
browser → core + error + request + white-screen
react   → core  (peerDependencies: react >= 16.x)
error/request/white-screen → core
```

---

## 核心包设计 (`@monit/core`)

### 配置接口

```ts
interface MonitorConfig {
  appId: string            // 项目唯一ID
  dsn: string              // 上报地址
  maxQueueSize?: number    // 批量上报阈值，默认 10
  flushInterval?: number   // 定时上报间隔(ms)，默认 5000
  plugins?: MonitorPlugin[]
}
```

### 插件接口

```ts
interface MonitorPlugin {
  name: string
  setup(ctx: MonitorContext): void
  teardown?(): void
}

interface MonitorContext {
  config: MonitorConfig
  report(event: Partial<MonitorEvent>): void
}
```

### 标准化事件结构

```ts
interface MonitorEvent {
  appId: string
  type: 'error' | 'request' | 'white-screen'
  subType: 'js' | 'promise' | 'resource' | 'xhr' | 'fetch' | 'white-screen' | 'react'
  timestamp: number
  url: string          // 发生页面 URL
  userAgent: string
  payload: Record<string, any>
}
```

### 上报队列策略

- `navigator.sendBeacon` 优先（页面关闭不丢数据），降级用 `fetch`
- 积累达 `maxQueueSize` 条时立即上报
- 每 `flushInterval` ms 定时上报
- 监听 `visibilitychange` → hidden 时立即 flush

---

## 各采集插件设计

### `@monit/error` — 错误采集

| 子类型 | 监听方式 | payload |
|--------|---------|---------|
| `js` | `window.onerror` | `{ message, filename, lineno, colno, stack }` |
| `promise` | `window.onunhandledrejection` | `{ message, stack, reason }` |
| `resource` | `window.addEventListener('error', capture)` | `{ tagName, src, outerHTML }` |

### `@monit/request` — 请求错误

- 重写 `XMLHttpRequest` 原型方法和 `window.fetch`
- 仅上报 status >= 400 或网络异常
- payload: `{ method, url, status, duration, requestBody, responseText }`

### `@monit/white-screen` — 白屏检测

1. 页面 `load` 后启动 `MutationObserver` 监听 DOM 变化
2. 若 **5s 内** body 有效子节点 < 阈值（默认 2），触发超时兜底
3. 超时后对页面做 **9宫格采样**（`elementFromPoint`）
4. 有效节点占比 < 50% 则判定白屏并上报
- payload: `{ samplePoints, validRatio, bodyChildCount }`

### `@monit/react` — React 组件错误

- 提供 `MonitorErrorBoundary` class 组件（兼容 React 16+）
- `componentDidCatch` 捕获并上报，支持 `fallback` prop 自定义降级 UI
- payload: `{ message, stack, componentStack }`

---

## 工程配置

### tsup 构建配置

```ts
// 通用包
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
})

// browser 包额外输出 UMD
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs', 'iife'],
  globalName: 'Monitor',   // window.Monitor
  dts: true,
  sourcemap: true,
  clean: true,
})
```

### 版本管理

使用 `changesets` 管理：
- 每个包独立版本号
- 自动生成 CHANGELOG
- `pnpm changeset` → `pnpm changeset version` → `pnpm publish -r`

### TypeScript 共享配置

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2015",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "lib": ["ES2015", "DOM"]
  }
}
```

---

## NPM 发布

- scope: `@monit`
- 每个包独立发布
- `browser` 包 `package.json` 配置 `exports` 字段支持 ESM/CJS 条件导出
- UMD 产物同时上传 CDN 供 script 标签使用
