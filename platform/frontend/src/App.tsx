import { useState } from 'react'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, AlertTriangle, Settings, Server,
  FolderKanban, ChevronDown, Plus,
} from 'lucide-react'
import Dashboard from './pages/Dashboard'
import ErrorDetail from './pages/ErrorDetail'
import ProjectSettings from './pages/ProjectSettings'
import ProjectList from './pages/ProjectList'
import BackendConfig, { useBackendConfigNeeded } from './components/BackendConfig'
import { getApiBase } from './lib/api'
import { ProjectProvider, useProject } from './context/ProjectContext'

function Sidebar({ onOpenBackendConfig }: { onOpenBackendConfig: () => void }) {
  const base = getApiBase()
  const label = base ? new URL(base).host : 'localhost (proxy)'
  const { projects, currentProject, setCurrentProject } = useProject()
  const navigate = useNavigate()
  const [projectsOpen, setProjectsOpen] = useState(false)

  const handleProjectChange = (appId: string) => {
    const p = projects.find((x) => x.appId === appId)
    if (p) {
      setCurrentProject(p)
      setProjectsOpen(false)
    }
  }

  return (
    <aside className="w-56 min-h-screen bg-gray-900 text-gray-300 flex flex-col">
      <div className="px-5 py-5 border-b border-gray-700">
        <span className="text-white font-bold text-lg tracking-tight">Monitor Platform</span>
        <p className="text-xs text-gray-400 mt-0.5">前端监控 + AI 根因分析</p>
      </div>

      {/* Project Switcher */}
      <div className="px-3 pt-4 pb-2">
        <p className="text-xs text-gray-500 uppercase tracking-wider px-2 mb-1.5">当前项目</p>
        <div className="relative">
          <button
            onClick={() => setProjectsOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-750 text-sm text-gray-200 transition-colors"
          >
            <span className="truncate flex-1 text-left">
              {currentProject ? currentProject.name : '选择项目…'}
            </span>
            <ChevronDown size={13} className={`flex-shrink-0 text-gray-400 transition-transform ${projectsOpen ? 'rotate-180' : ''}`} />
          </button>

          {projectsOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleProjectChange(p.appId)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-700 transition-colors flex items-center gap-2 ${
                    currentProject?.id === p.id ? 'text-blue-400' : 'text-gray-300'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.active ? 'bg-green-400' : 'bg-gray-500'}`} />
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
              <div className="border-t border-gray-700">
                <button
                  onClick={() => { setProjectsOpen(false); navigate('/projects') }}
                  className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700 flex items-center gap-2 transition-colors"
                >
                  <Plus size={12} />
                  管理所有项目
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-400 hover:text-white'
            }`
          }
        >
          <LayoutDashboard size={16} />
          总览
        </NavLink>
        <NavLink
          to="/errors"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-400 hover:text-white'
            }`
          }
        >
          <AlertTriangle size={16} />
          错误列表
        </NavLink>
        <NavLink
          to="/projects"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-400 hover:text-white'
            }`
          }
        >
          <FolderKanban size={16} />
          项目管理
        </NavLink>
        {currentProject && (
          <NavLink
            to={`/settings/${currentProject.appId}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-400 hover:text-white'
              }`
            }
          >
            <Settings size={16} />
            项目设置
          </NavLink>
        )}
      </nav>

      {/* Backend URL config */}
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

function AppInner() {
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
          <Route path="/projects" element={<ProjectList />} />
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

export default function App() {
  return (
    <ProjectProvider>
      <AppInner />
    </ProjectProvider>
  )
}
