import { Routes, Route, NavLink } from 'react-router-dom'
import { LayoutDashboard, AlertTriangle, Settings } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import ErrorDetail from './pages/ErrorDetail'
import ProjectSettings from './pages/ProjectSettings'

const navItems = [
  { to: '/', label: '总览', icon: LayoutDashboard, exact: true },
  { to: '/errors', label: '错误列表', icon: AlertTriangle },
  { to: '/settings/react-demo', label: '项目设置', icon: Settings },
]

function Sidebar() {
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
      <div className="px-4 py-3 border-t border-gray-700 text-xs text-gray-500">
        v0.1.0 · SDK + RAG + LangGraph
      </div>
    </aside>
  )
}

export default function App() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/errors" element={<Dashboard showErrors />} />
          <Route path="/errors/:id" element={<ErrorDetail />} />
          <Route path="/settings/:appId" element={<ProjectSettings />} />
        </Routes>
      </main>
    </div>
  )
}
