import axios from 'axios'

const LS_KEY = 'MONITOR_API_BASE'

/** 读取当前生效的后端根地址（无 /api 后缀） */
export function getApiBase(): string {
  // 1. localStorage 运行时配置（最优先）
  const fromStorage = localStorage.getItem(LS_KEY)
  if (fromStorage) return fromStorage.replace(/\/$/, '')
  // 2. 构建时注入的环境变量
  if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE.replace(/\/$/, '')
  // 3. 本地开发默认走 Vite proxy（/api → localhost:4000）
  return ''
}

/** 更新后端地址并刷新页面使配置生效 */
export function setApiBase(url: string) {
  if (url) {
    localStorage.setItem(LS_KEY, url.replace(/\/$/, ''))
  } else {
    localStorage.removeItem(LS_KEY)
  }
}

export const api = axios.create({ baseURL: '/api' })

// 每次请求前动态读取 baseURL，确保 localStorage 更改即时生效（无需刷新）
api.interceptors.request.use((config) => {
  const base = getApiBase()
  config.baseURL = base ? `${base}/api` : '/api'
  return config
})

// ── Types ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string
  appId: string
  name: string
  description: string
  active: boolean
  createdAt: string
  sourcemapVersion?: string
  sourcemapDir?: string | null
  sourceRoot?: string | null
  repoUrl?: string | null
  repoToken?: string | null
}

export interface ErrorEvent {
  id: string
  appId: string
  type: string
  subType: string
  timestamp: number
  url: string
  userAgent: string
  payload: Record<string, unknown>
  status: 'new' | 'analyzing' | 'analyzed' | 'resolved'
  analysis: AnalysisResult | null
  createdAt: string
}

export interface AnalysisResult {
  resolvedStack: Array<{
    source: string | null
    line: number | null
    column: number | null
    name: string | null
  }>
  relatedCode: string[]
  diagnosis: string
  suggestedFix: string
  reviewNote: string
  warnings: string[]
  analyzedAt: string
  error?: string
}

export interface StatsData {
  [subType: string]: number
}

export interface TrendPoint {
  date: string
  count: number
}

// ── API helpers ───────────────────────────────────────────────────────────

export const projectsApi = {
  list: () => api.get<Project[]>('/projects').then((r) => r.data),
  get: (id: string) => api.get<Project>(`/projects/${id}`).then((r) => r.data),
  create: (data: Partial<Project>) => api.post<Project>('/projects', data).then((r) => r.data),
  update: (id: string, data: Partial<Project>) =>
    api.patch<Project>(`/projects/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/projects/${id}`),
}

export const errorsApi = {
  list: (params: Record<string, unknown>) =>
    api
      .get<{ data: ErrorEvent[]; total: number }>('/errors', { params })
      .then((r) => r.data),
  get: (id: string) => api.get<ErrorEvent>(`/errors/${id}`).then((r) => r.data),
  stats: (appId: string) => api.get<StatsData>(`/errors/stats/${appId}`).then((r) => r.data),
  trend: (appId: string) => api.get<TrendPoint[]>(`/errors/trend/${appId}`).then((r) => r.data),
}

export interface ApplyResult {
  branch: string
  prUrl: string | null
  files: string[]
  commitHash: string
}

export const analysisApi = {
  analyze: (errorEventId: string, version?: string) =>
    api
      .post<AnalysisResult>(`/analysis/analyze/${errorEventId}`, null, {
        params: version ? { version } : {},
      })
      .then((r) => r.data),
  apply: (errorEventId: string) =>
    api.post<ApplyResult>(`/analysis/apply/${errorEventId}`).then((r) => r.data),
}
