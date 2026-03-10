import { useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { LayoutDashboard, AlertTriangle, Settings, Server } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import ErrorDetail from './pages/ErrorDetail'
import ProjectSettings from './pages/ProjectSettings'
import BackendConfig, { useBackendConfigNeeded } from './components/BackendConfig'
import { getApiBase } from './lib/api'

const navItems = [
  { to: '/', label: '总览', icon: LayoutDashboard, exact: true },
  { to: '/errors', label: '错误列表', icon: AlertTriangle },
  { to: '/settings/react-demo', label: '项目设置', icon: Settings },
]

function Sidebar({ onOpenBackendConfig }: { onOpenBackendConfig: () => void }) {
  const base = getApiBase()
  const label = base ? new URL(base).host : 'localhost (proxy)'

  return (
    <aside className="w-56 min-h-screen bg-gray-900 text-gray-300 flex flex-col">
      <div className="px-5 py-5 border-b border-gray-700">
        <span className="text-white font-bold text-lg tracking-tight">Monitor Platform</span>
        <p className="text-xs text-gray-400 mt-0.5">前端监控 + AI 根因分析</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-800 text-gray-400 hover:text-white'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
      {/* Backend URL config button */}
      <button
        onClick={onOpenBackendConfig}
        className="mx-3 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-800 hover:text-gray-300 transition-colors text-left"
        title="点击修改后端地址"
      >
        <Server size={13} className="flex-shrink-0" />
        <span className="truncate">{label}</span>
      </button>
      <div className="px-4 py-3 border-t border-gray-700 text-xs text-gray-500">
        v0.1.0 · SDK + RAG + LangGraph
      </div>
    </aside>
  )
}

export default function App() {
  const [showConfig, setShowConfig] = useState(false)
  const [autoNeeded, setAutoNeeded] = useBackendConfigNeeded()

  const showModal = showConfig || autoNeeded

  return (
    <div className="flex min-h-screen">
      <Sidebar onOpenBackendConfig={() => setShowConfig(true)} />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/errors" element={<Dashboard showErrors />} />
          <Route path="/errors/:id" element={<ErrorDetail />} />
          <Route path="/settings/:appId" element={<ProjectSettings />} />
        </Routes>
      </main>
      {showModal && (
        <BackendConfig
          onClose={() => {
            setShowConfig(false)
            setAutoNeeded(false)
          }}
        />
      )}
    </div>
  )
}
