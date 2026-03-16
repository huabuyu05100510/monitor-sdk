# Monitor SDK 项目功能全景

前端错误监控全链路平台，从错误采集到 AI 自动修复，覆盖完整闭环。

## 整体架构

```
SDK（浏览器端采集）→ 后端（存储 + 源码还原）→ AI 分析 → 自动修复 → 提交 PR
```

项目采用 **pnpm monorepo**，分为三大模块：

| 模块 | 技术栈 | 作用 |
|------|--------|------|
| `packages/` | TypeScript + tsup | SDK 插件包（6 个） |
| `platform/backend/` | NestJS + LangGraph + ChromaDB | 后端 API + AI 分析 |
| `platform/frontend/` | React + TailwindCSS + Recharts | 监控仪表盘 |
| `demos/react-demo/` | React + Vite | 错误场景演示 |

## 一、SDK 错误采集（6 个包）

| 包名 | 功能 |
|------|------|
| **@monit/core** | 核心引擎：插件机制、事件队列、sendBeacon/fetch 上报 |
| **@monit/error** | JS 同步错误（onerror）、Promise 未捕获异常、资源加载失败 |
| **@monit/request** | XHR / Fetch 请求监控（状态码 >= 400 或网络异常） |
| **@monit/white-screen** | 白屏检测（9 点采样 + MutationObserver，5s 超时） |
| **@monit/react** | React ErrorBoundary 组件，捕获渲染错误 + componentStack |
| **@monit/browser** | 一体化入口，打包所有插件，支持 ESM/CJS/UMD |

### @monit/core

核心模块，提供：

- **Monitor 类**：中央调度器，管理插件和配置
- **插件接口**：`{ name, setup(ctx), teardown?() }`
- **ReportQueue**：事件批量缓冲，可配置 `maxQueueSize` 和 `flushInterval`
- **Reporter**：优先使用 `navigator.sendBeacon`，降级 `fetch`
- **MonitorEvent**：标准化事件结构（appId、type、subType、timestamp、url、userAgent、payload）

事件类型：

- `MonitorEventType`: `'error' | 'request' | 'white-screen'`
- `MonitorEventSubType`: `'js' | 'promise' | 'resource' | 'react' | 'xhr' | 'fetch' | 'white-screen'`

### @monit/error

三个错误采集插件：

1. **jsError** — 挂载 `window.onerror`，捕获同步 JS 错误
2. **promiseError** — 监听 `unhandledrejection`，捕获未处理的 Promise 异常
3. **resourceError** — 捕获阶段 `error` 事件监听，采集资源加载失败（img、script、link、audio、video）

### @monit/request

两个请求监控插件：

1. **xhrPlugin** — 劫持 `XMLHttpRequest.prototype.open/send`，捕获失败请求（status >= 400 或网络错误）
2. **fetchPlugin** — 包装 `window.fetch`，捕获失败请求和网络异常

上报 payload 包含：`method`、`url`、`status`、`duration`、`requestBody`、`responseText`

### @monit/white-screen

白屏检测机制：

- 使用 MutationObserver 观察 DOM 变化
- 超时触发检测（默认 5s）
- 9 点网格采样（`document.elementFromPoint()`）
- 有效元素比例 < 50% 则判定为白屏

### @monit/react

- **MonitorErrorBoundary**：React class 组件，实现 `componentDidCatch`
- 捕获 React 渲染错误，附带 `componentStack`
- 支持自定义 `fallback` UI
- 可通过 prop 或全局 `setErrorBoundaryContext()` 传入上下文

### @monit/browser

一体化入口：

- 整合所有插件（error、request、white-screen）
- 导出 `init(config)` 快速初始化
- 输出 ESM、CJS 和 IIFE（全局 `window.Monitor`）

## 二、后端平台

**技术栈：** NestJS + TypeORM + PostgreSQL/SQLite + LangChain/LangGraph + ChromaDB

### API 端点

| 端点 | 说明 |
|------|------|
| `POST /api/errors/report` | SDK 错误上报接口 |
| `GET /api/errors` | 错误列表查询（分页/过滤） |
| `GET /api/errors/:id` | 错误详情 |
| `GET /api/errors/stats/:appId` | 按 subType 统计错误数 |
| `GET /api/errors/trend/:appId` | 7 日错误趋势 |
| `POST /api/sourcemaps/upload` | 上传 .map 文件 |
| `POST /api/sourcemaps/resolve` | 调试接口：还原堆栈 |
| `POST /api/sourcemaps/sync` | Git pull 同步 CI 提交的 Source Map |
| `GET /api/projects` | 项目列表 |
| `POST /api/analysis/analyze/:id` | 触发 AI 根因分析 |
| `POST /api/analysis/apply/:id` | 自动应用修复并创建 PR |
| `POST /api/analysis/index-source/:appId` | 索引源码到 RAG |

### 核心服务

1. **ErrorsService** — 接收和存储错误事件，提供查询、统计和趋势数据
2. **SourcemapsService** — 存储 .map 文件，还原压缩堆栈到源码位置，支持 GitHub Raw 回源
3. **AnalysisService** — 编排 LangGraph 分析流水线，更新错误状态（new → analyzing → analyzed）
4. **CodeRagService** — 管理 ChromaDB 向量库，使用本地哈希词袋模型生成嵌入，按函数级别切片索引源码
5. **CodeReaderService** — 从 sourceRoot 读取源文件，提取错误行附近的代码片段
6. **AutoApplyService** — 从 AI 建议中提取补丁，应用到源码，创建 Git 分支并提交 GitHub PR

### LangGraph AI 分析流水线

```
resolve → reindex → retrieve → analyst → review → END
```

| 节点 | 功能 |
|------|------|
| **resolve** | 使用 Source Map 还原压缩堆栈 |
| **reindex** | 检测新 Source Map 并重新索引 RAG |
| **retrieve** | 获取相关代码（直接读取 + ChromaDB 语义检索） |
| **analyst** | LLM 生成根因诊断和修复建议 |
| **review** | LLM 复审诊断质量 |

### 数据实体

- **ErrorEvent**（`error_events` 表）：存储上报的错误，包含状态和 AI 分析结果
- **Project**（`projects` 表）：项目配置（sourcemapVersion、sourcemapDir、sourceRoot、repoUrl、repoToken）
- **Sourcemap**（`sourcemaps` 表）：上传的 Source Map 元数据

## 三、前端仪表盘

**技术栈：** React 18 + Vite + TailwindCSS + Recharts + React Router

| 页面 | 功能 |
|------|------|
| **Dashboard** | 错误总览：统计卡片、7 日趋势折线图、类型分布饼图、分页错误列表 |
| **ErrorDetail** | 错误详情：原始堆栈、还原后源码、AI 诊断报告、修复建议、一键创建 PR |
| **ProjectSettings** | 项目配置：Source Map 版本/路径、源码目录、仓库 URL/Token、RAG 索引 |
| **ProjectList** | 多项目管理：创建和管理多个监控项目 |

### ErrorDetail 页面布局

- **左栏**：原始错误 payload、用户上下文、还原后的堆栈
- **中栏**：AI 诊断报告、RAG 检索到的相关代码片段
- **右栏**：AI 修复建议、代码审查备注、风险提示
- 操作按钮："AI 根因分析"、"应用修复并创建 PR"

## 四、Demo 应用（ErrorLab）

模拟 **16+ 种真实业务错误场景**，用于测试完整链路：

| 服务模块 | 错误场景 |
|----------|----------|
| 用户服务 | Profile 加载空指针、JWT 角色解析缺失字段 |
| 库存服务 | 库存查询 undefined 访问、商品规格空指针 |
| 结算服务 | 优惠券 JSON 截断、折扣计算无限递归、支付超时 |
| 数据服务 | 推荐同步 500 错误、Chunk 加载 404 |
| 物流服务 | 运单标签字段缺失、Session 刷新 NaN |
| 财务服务 | 发票生成负数溢出、Webhook Base64 编码异常 |
| 配置服务 | 商品搜索正则语法错误、配置导出循环引用 |
| React 组件 | 订单组件异步 JSON 解析、价格卡片空库存 |

## 五、CI/CD 与部署

### GitHub Actions

1. **deploy-demo.yml**：构建 SDK + React Demo → 自动提交 Source Map → 部署到 GitHub Pages
2. **deploy-hf-backend.yml**：上传后端到 Hugging Face Spaces

### 部署方式

| 服务 | 平台 | 方式 |
|------|------|------|
| React Demo | GitHub Pages | 静态部署 |
| 后端 API | Render.com | Docker 容器 |
| 后端 API（备选） | Hugging Face Spaces | Python SDK 上传 |

### Source Map 安全

- CI 构建后自动提交 .map 文件到仓库（`uploads/sourcemaps/react-demo/{sha}/`）
- 部署产物中移除 .map 文件，不暴露于公开页面

### 环境变量

| 变量 | 用途 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接串 |
| `SQLITE_PATH` | SQLite 降级路径 |
| `SOURCEMAP_DIR` | Source Map 存储目录 |
| `CORS_ORIGIN` | CORS 允许来源 |
| `OPENAI_API_KEY` | LLM API 密钥 |
| `OPENAI_BASE_URL` | LLM API 地址 |
| `OPENAI_MODEL` | 模型名称（gpt-4o / qwen3-coder-next 等） |
| `CHROMA_URL` | ChromaDB 向量库地址 |
| `GITHUB_RAW_BASE` | GitHub Raw URL（回源 Source Map） |
| `GITHUB_TOKEN` | 自动修复 PR 创建用 |
| `GITHUB_REPO` | 目标仓库 |

## 总结

> 一个从 **SDK 错误采集 → Source Map 堆栈还原 → AI 根因分析 → 自动生成修复 PR** 的端到端前端监控平台，实现了"错误发生 → AI 自动修 → 开发者审核合并"的完整闭环。
