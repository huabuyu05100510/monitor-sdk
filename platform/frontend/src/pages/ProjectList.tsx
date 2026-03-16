import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Trash2, Settings, BarChart2, CheckCircle2, XCircle,
  Loader2, FolderKanban, GitBranch, ChevronDown,
} from 'lucide-react'
import { projectsApi, type Project } from '../lib/api'
import { useProject } from '../context/ProjectContext'

export default function ProjectList() {
  const { projects, currentProject, setCurrentProject, reload } = useProject()
  const navigate = useNavigate()

  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null)
  const [form, setForm] = useState({ appId: '', name: '', description: '', repoUrl: '', repoToken: '' })
  const [formError, setFormError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleCreate = async () => {
    if (!form.appId.trim()) { setFormError('appId 不能为空'); return }
    if (!form.name.trim()) { setFormError('项目名称不能为空'); return }
    setFormError(null)
    setCreating(true)
    try {
      const p = await projectsApi.create({
        appId: form.appId.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        repoUrl: form.repoUrl.trim() || undefined,
        repoToken: form.repoToken.trim() || undefined,
      })
      await reload()
      setCurrentProject(p)
      setForm({ appId: '', name: '', description: '', repoUrl: '', repoToken: '' })
      setShowAdvanced(false)
      setShowCreate(false)
    } catch (e: any) {
      setFormError(e?.response?.data?.message ?? '创建失败，appId 可能已存在')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(confirmDelete.id)
    setConfirmDelete(null)
    try {
      await projectsApi.remove(confirmDelete.id)
      await reload()
    } catch { /* ignore */ } finally {
      setDeleting(null)
    }
  }

  const goSettings = (p: Project) => {
    setCurrentProject(p)
    navigate(`/settings/${p.appId}`)
  }

  const goDashboard = (p: Project) => {
    setCurrentProject(p)
    navigate('/')
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FolderKanban size={22} className="text-blue-500" />
            项目管理
          </h1>
          <p className="text-sm text-gray-500 mt-1">管理所有监控接入项目</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={15} />
          新建项目
        </button>
      </div>

      {/* Project Cards */}
      {projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-16 text-center">
          <FolderKanban size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">还没有项目，点击「新建项目」开始接入</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((p) => (
            <div
              key={p.id}
              className={`bg-white rounded-xl border shadow-sm p-5 flex items-center gap-4 transition-all ${
                currentProject?.id === p.id
                  ? 'border-blue-400 ring-1 ring-blue-200'
                  : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              {/* Active indicator */}
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.active ? 'bg-green-400' : 'bg-gray-300'}`} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900">{p.name}</span>
                  <code className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">
                    {p.appId}
                  </code>
                  {currentProject?.id === p.id && (
                    <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                      当前
                    </span>
                  )}
                </div>
                {p.description && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{p.description}</p>
                )}
                <p className="text-xs text-gray-300 mt-1 flex items-center gap-3 flex-wrap">
                  <span>创建于 {new Date(p.createdAt).toLocaleDateString('zh-CN')}</span>
                  {p.sourceRoot && <span className="text-green-500">✓ 源码</span>}
                  {p.repoUrl && <span className="text-blue-400">✓ 仓库</span>}
                  {p.repoToken && <span className="text-purple-400">✓ Token</span>}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => goDashboard(p)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <BarChart2 size={13} />
                  总览
                </button>
                <button
                  onClick={() => goSettings(p)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-purple-600 border border-gray-200 hover:border-purple-300 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Settings size={13} />
                  设置
                </button>
                {deleting === p.id ? (
                  <Loader2 size={15} className="animate-spin text-gray-400" />
                ) : (
                  <button
                    onClick={() => setConfirmDelete(p)}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Trash2 size={13} />
                    删除
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">新建项目</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  App ID <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.appId}
                  onChange={(e) => setForm((f) => ({ ...f, appId: e.target.value }))}
                  placeholder="例：my-app  （SDK 接入时填写的 appId）"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  项目名称 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="例：我的 React 应用"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">描述（可选）</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="简短说明项目用途"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {/* Advanced: repo config */}
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <GitBranch size={12} />
                    仓库配置（Auto-Apply PR 用）
                  </span>
                  <ChevronDown size={12} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                </button>
                {showAdvanced && (
                  <div className="px-3 pb-3 pt-1 space-y-3 border-t border-gray-100 bg-gray-50">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">仓库地址</label>
                      <input
                        type="url"
                        value={form.repoUrl}
                        onChange={(e) => setForm((f) => ({ ...f, repoUrl: e.target.value }))}
                        placeholder="https://github.com/owner/repo"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        GitHub Token
                        <span className="ml-1.5 text-gray-400 font-normal">（需 repo 权限）</span>
                      </label>
                      <input
                        type="password"
                        value={form.repoToken}
                        onChange={(e) => setForm((f) => ({ ...f, repoToken: e.target.value }))}
                        placeholder="ghp_xxxxxxxxxxxx"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono bg-white"
                        autoComplete="off"
                      />
                      <p className="text-xs text-gray-400 mt-1">留空则使用后端 .env 中的全局 GITHUB_TOKEN</p>
                    </div>
                  </div>
                )}
              </div>

              {formError && (
                <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <XCircle size={14} />
                  {formError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowCreate(false); setFormError(null); setShowAdvanced(false); setForm({ appId: '', name: '', description: '', repoUrl: '', repoToken: '' }) }}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {creating ? '创建中…' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">确认删除</h2>
                <p className="text-xs text-gray-400">此操作不可撤销</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              将删除项目 <strong>{confirmDelete.name}</strong>（<code className="bg-gray-100 px-1 rounded">{confirmDelete.appId}</code>）。
              <br />
              <span className="text-amber-600 text-xs mt-1 block">注意：相关错误记录不会被删除。</span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
              >
                <Trash2 size={13} />
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
