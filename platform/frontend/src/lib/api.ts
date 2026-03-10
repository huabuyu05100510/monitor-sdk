import axios from 'axios'

export const api = axios.create({ baseURL: '/api' })

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

export const analysisApi = {
  analyze: (errorEventId: string, version?: string) =>
    api
      .post<AnalysisResult>(`/analysis/analyze/${errorEventId}`, null, {
        // Omit version param if empty so backend falls back to project.sourcemapVersion
        params: version ? { version } : {},
      })
      .then((r) => r.data),
}
