# Monitor Platform

基于 RAG + LangGraph 的前端监控根因分析平台。

## 架构

```
SDK（react-demo）
    │ sendBeacon / fetch
    ▼
Nest.js Backend  (:4000)
    ├── POST /api/errors/report     ← SDK 上报入口
    ├── GET  /api/errors            ← 错误列表
    ├── POST /api/sourcemaps/upload ← 上传 Source Map
    ├── POST /api/analysis/analyze/:id  ← 触发 AI 分析
    └── GET  /api/docs              ← Swagger 文档
         │
         ├── PostgreSQL  ── 存储 ErrorEvent / Project / Sourcemap
         ├── ChromaDB    ── 代码向量索引（RAG）
         └── OpenAI API  ── LLM 根因分析（GPT-4o / DeepSeek）

React Dashboard  (:5173)
    ├── /           ← 总览（趋势图 + 错误分布 + 列表）
    └── /errors/:id ← 详情（堆栈 + RAG源码 + AI诊断 + 修复方案）
```

## LangGraph 分析流

```
resolve → retrieve → analyst → review → END
   │          │          │         │
  还原       RAG        LLM      代码
  堆栈      检索       诊断      审查
```

## 快速启动

### 前置条件

```bash
# 1. PostgreSQL
docker run -d --name pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16

# 2. ChromaDB（可选，无则 RAG 返回空结果）
docker run -d --name chroma -p 8000:8000 chromadb/chroma
```

### 后端

```bash
cd platform/backend
cp .env.example .env
# 编辑 .env，填写 OPENAI_API_KEY 等

pnpm start:dev
# http://localhost:4000/api/docs
```

### 前端

```bash
cd platform/frontend
pnpm dev
# http://localhost:5173
```

### SDK Demo（上报数据源）

```bash
cd demos/react-demo
pnpm dev
# http://localhost:3000
# 点击页面上的按钮触发错误，数据将实时上报至 backend
```

## 上传 Source Map

构建 react-demo 后，将生成的 .map 文件上传：

```bash
curl -X POST http://localhost:4000/api/sourcemaps/upload \
  -F "appId=react-demo" \
  -F "version=$(git rev-parse HEAD)" \
  -F "filename=index-xxx.js" \
  -F "map=@dist/assets/index-xxx.js.map"
```

## 触发 AI 分析

```bash
# 获取错误 ID（从前端列表或 /api/errors 接口）
ERROR_ID=<uuid>

curl -X POST "http://localhost:4000/api/analysis/analyze/${ERROR_ID}?version=latest"
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DB_HOST` | PostgreSQL 地址 | localhost |
| `DB_PORT` | PostgreSQL 端口 | 5432 |
| `OPENAI_API_KEY` | OpenAI / DeepSeek API Key | — |
| `OPENAI_BASE_URL` | API 代理地址 | https://api.openai.com/v1 |
| `OPENAI_MODEL` | 模型名称 | gpt-4o |
| `CHROMA_URL` | ChromaDB 地址 | http://localhost:8000 |
