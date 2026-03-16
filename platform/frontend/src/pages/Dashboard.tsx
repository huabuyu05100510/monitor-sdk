import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, TrendingUp, Layers, RefreshCw,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { errorsApi, type TrendPoint, type StatsData } from '../lib/api'
import { useProject } from '../context/ProjectContext'
import { useErrors } from '../hooks/useErrors'
import { SubTypeBadge } from '../components/SubTypeBadge'
import { StatusBadge } from '../components/StatusBadge'

const PIE_COLORS = ['#f87171', '#fb923c', '#facc15', '#a78bfa', '#60a5fa', '#34d399']

interface Props {
  showErrors?: boolean
}

export default function Dashboard({ showErrors }: Props) {
  const { projects, currentProject, setCurrentProject } = useProject()
  const appId = currentProject?.appId ?? ''

  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [stats, setStats] = useState<StatsData>({})
  const [page, setPage] = useState(1)

  const { data: errors, total, loading, refetch } = useErrors({ appId, page, limit: 15 })

  useEffect(() => {
    setPage(1)
  }, [appId])

  useEffect(() => {
    if (!appId) return
    errorsApi.trend(appId).then(setTrend).catch(() => {})
    errorsApi.stats(appId).then(setStats).catch(() => {})
  }, [appId])

  const pieData = Object.entries(stats).map(([name, value]) => ({ name, value }))
  const totalErrors = Object.values(stats).reduce((a, b) => a + b, 0)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">错误监控总览</h1>
          <p className="text-sm text-gray-500 mt-1">实时接收 SDK 上报 · AI 根因分析</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Project switcher - synced with global context */}
          <select
            value={appId}
            onChange={(e) => {
              const p = projects.find((x) => x.appId === e.target.value)
              if (p) setCurrentProject(p)
            }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {projects.length === 0 && <option value="">暂无项目</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.appId}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={refetch}
            className="flex items-center gap-1.5 text-sm bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={14} />
            刷新
          </button>
        </div>
      </div>

      {!appId ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-16 text-center text-sm text-gray-400">
          请先在左侧选择或创建一个项目
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="总错误数"
              value={totalErrors}
              icon={<AlertTriangle size={18} className="text-red-500" />}
              color="bg-red-50"
            />
            <StatCard
              label="近 7 天趋势"
              value={trend.reduce((a, b) => a + b.count, 0)}
              icon={<TrendingUp size={18} className="text-blue-500" />}
              color="bg-blue-50"
            />
            <StatCard
              label="错误类型"
              value={Object.keys(stats).length}
              icon={<Layers size={18} className="text-purple-500" />}
              color="bg-purple-50"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">近 7 天错误趋势</h2>
              {trend.length === 0 ? (
                <EmptyPlaceholder text="暂无数据" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">错误类型分布</h2>
              {pieData.length === 0 ? (
                <EmptyPlaceholder text="暂无数据" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Error Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">最新错误列表</h2>
              <span className="text-xs text-gray-400">共 {total} 条</span>
            </div>
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-400">加载中…</div>
            ) : errors.length === 0 ? (
              <EmptyPlaceholder text="暂无错误记录，等待 SDK 上报…" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 uppercase tracking-wide bg-gray-50">
                    <th className="px-5 py-3">类型</th>
                    <th className="px-5 py-3">错误信息</th>
                    <th className="px-5 py-3">页面 URL</th>
                    <th className="px-5 py-3">状态</th>
                    <th className="px-5 py-3">时间</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {errors.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <SubTypeBadge subType={e.subType} />
                      </td>
                      <td className="px-5 py-3 max-w-xs">
                        <span className="truncate block text-gray-700" title={e.payload.message as string}>
                          {(e.payload.message as string) ?? e.subType}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-400 max-w-xs">
                        <span className="truncate block text-xs">{e.url}</span>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={e.status} />
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(e.createdAt).toLocaleString('zh-CN')}
                      </td>
                      <td className="px-5 py-3">
                        <Link
                          to={`/errors/${e.id}`}
                          className="text-blue-500 hover:text-blue-700 text-xs font-medium"
                        >
                          详情 →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {total > 15 && (
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                <span>第 {page} 页 / 共 {Math.ceil(total / 15)} 页</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * 15 >= total}
                    className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({
  label, value, icon, color,
}: {
  label: string
  value: number
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className={`${color} rounded-xl p-5 flex items-center gap-4`}>
      <div className="p-2 bg-white rounded-lg shadow-sm">{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
      </div>
    </div>
  )
}

function EmptyPlaceholder({ text }: { text: string }) {
  return (
    <div className="p-10 text-center text-sm text-gray-400">{text}</div>
  )
}
