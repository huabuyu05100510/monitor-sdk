import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Save, FolderOpen, Tag, Code2, CheckCircle2, AlertTriangle,
  Database, Loader2, RefreshCw, Pencil, Trash2, Info, GitBranch, Eye, EyeOff,
} from 'lucide-react'
import { projectsApi, type Project } from '../lib/api'
import { api } from '../lib/api'
import { useProject } from '../context/ProjectContext'

export default function ProjectSettings() {
  const { appId } = useParams<{ appId: string }>()
  const navigate = useNavigate()
  const { reload: reloadProjects, setCurrentProject } = useProject()

  const [project, setProject] = useState<Project | null>(null)
  const [basicForm, setBasicForm] = useState({ name: '', description: '' })
  const [form, setForm] = useState({ sourcemapVersion: '', sourcemapDir: '', sourceRoot: '' })
  const [saving, setSaving] = useState(false)
  const [savingBasic, setSavingBasic] = useState(false)
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [indexing, setIndexing] = useState(false)
  const [indexResult, setIndexResult] = useState<{ files: number; indexed: number; skipped: number } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncOutput, setSyncOutput] = useState<string | null>(null)
  const [repoForm, setRepoForm] = useState({ repoUrl: '', repoToken: '' })
  const [savingRepo, setSavingRepo] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!appId) return
    projectsApi.list().then((list) => {
      const p = list.find((p) => p.appId === appId)
      if (p) {
        setProject(p)
        setBasicForm({ name: p.name, description: p.description ?? '' })
        setForm({
          sourcemapVersion: p.sourcemapVersion ?? 'latest',
          sourcemapDir: p.sourcemapDir ?? '',
          sourceRoot: p.sourceRoot ?? '',
        })
        setRepoForm({
          repoUrl: p.repoUrl ?? '',
          repoToken: p.repoToken ?? '',
        })
      }
    })
  }, [appId])

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const saveBasic = async () => {
    if (!project) return
    setSavingBasic(true)
    try {
      const updated = await projectsApi.update(project.id, {
        name: basicForm.name.trim() || project.name,
        description: basicForm.description.trim() || undefined,
      })
      setProject(updated)
      setCurrentProject(updated)
      await reloadProjects()
      showToast('ok', '基本信息已保存')
    } catch {
      showToast('err', '保存失败')
    } finally {
      setSavingBasic(false)
    }
  }

  const save = async () => {
    if (!project) return
    setSaving(true)
    try {
      const updated = await projectsApi.update(project.id, {
        sourcemapVersion: form.sourcemapVersion || 'latest',
        sourcemapDir: form.sourcemapDir || null,
        sourceRoot: form.sourceRoot || null,
      })
      setProject(updated)
      showToast('ok', '保存成功')
    } catch {
      showToast('err', '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const syncMaps = async () => {
    setSyncing(true)
    setSyncOutput(null)
    try {
      const r = await api.post<{ ok: boolean; output: string }>('/sourcemaps/sync')
      setSyncOutput(r.data.output || 'Already up to date.')
      showToast('ok', '同步完成')
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'git pull 失败'
      setSyncOutput(msg)
      showToast('err', msg)
    } finally {
      setSyncing(false)
    }
  }

  const indexSource = async () => {
    if (!appId) return
    setIndexing(true)
    setIndexResult(null)
    try {
      const r = await api.post<{ files: number; indexed: number; skipped: number }>(`/analysis/index-source/${appId}`)
      setIndexResult(r.data)
      showToast('ok', `索引完成：${r.data.indexed} 个代码块`)
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? '索引失败，请检查 sourceRoot 是否配置正确'
      showToast('err', msg)
    } finally {
      setIndexing(false)
    }
  }

  const saveRepo = async () => {
    if (!project) return
    setSavingRepo(true)
    try {
      const updated = await projectsApi.update(project.id, {
        repoUrl: repoForm.repoUrl.trim() || null,
        repoToken: repoForm.repoToken.trim() || null,
      })
      setProject(updated)
      showToast('ok', '仓库配置已保存')
    } catch {
      showToast('err', '保存失败')
    } finally {
      setSavingRepo(false)
    }
  }

  const deleteProject = async () => {
    if (!project) return
    setDeleting(true)
    try {
      await projectsApi.remove(project.id)
      await reloadProjects()
      navigate('/projects')
    } catch {
      showToast('err', '删除失败')
      setDeleting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-5">
        <button onClick={() => navigate('/projects')} className="hover:text-gray-600 transition-colors">项目管理</button>
        <span>/</span>
        <span className="text-gray-700 font-medium">{project?.name ?? appId}</span>
        <span>/</span>
        <span>设置</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">项目设置</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-mono">{appId}</code>
          </p>
        </div>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center gap-2 text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 text-sm px-3 py-2 rounded-lg transition-colors"
        >
          <Trash2 size={14} />
          删除项目
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mb-4 flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg border ${
          toast.type === 'ok'
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-600'
        }`}>
          {toast.type === 'ok' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {toast.msg}
        </div>
      )}

      {/* Basic Info */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-4 divide-y divide-gray-50">
        <div className="px-5 py-4 flex items-center gap-2">
          <Pencil size={14} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">基本信息</h2>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">项目名称</label>
            <input
              type="text"
              value={basicForm.name}
              onChange={(e) => setBasicForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="项目显示名称"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">描述</label>
            <input
              type="text"
              value={basicForm.description}
              onChange={(e) => setBasicForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="项目用途说明（可选）"
            />
          </div>
        </div>
        <div className="px-5 py-3 flex justify-end">
          <button
            onClick={saveBasic}
            disabled={savingBasic || !project}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {savingBasic ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {savingBasic ? '保存中…' : '保存'}
          </button>
        </div>
      </div>

      {/* Sync banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-800 mb-1">CI 自动同步 Source Maps</p>
            <p className="text-xs text-blue-600 leading-relaxed">
              每次推送到 master 后，GitHub Actions 会自动构建并把 <code className="bg-blue-100 px-1 rounded">.map</code> 文件 commit 回仓库。<br />
              点击「同步」执行 <code className="bg-blue-100 px-1 rounded">git pull</code>，本地后端立即获得最新 source maps，无需手动上传。
            </p>
            {syncOutput && (
              <pre className="mt-2 text-xs bg-blue-100 text-blue-900 rounded p-2 font-mono whitespace-pre-wrap">{syncOutput}</pre>
            )}
          </div>
          <button
            onClick={syncMaps}
            disabled={syncing}
            className="flex-shrink-0 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {syncing ? '同步中…' : '同步'}
          </button>
        </div>
      </div>

      {/* Repo Config */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-4 divide-y divide-gray-50">
        <div className="px-5 py-4 flex items-center gap-2">
          <GitBranch size={14} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">仓库配置</h2>
          <span className="text-xs text-gray-400 font-normal ml-1">· Auto-Apply 推分支 / 提 PR 使用</span>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">仓库地址</label>
            <input
              type="url"
              value={repoForm.repoUrl}
              onChange={(e) => setRepoForm((f) => ({ ...f, repoUrl: e.target.value }))}
              placeholder="https://github.com/owner/repo"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">AI 修复后将向此仓库推送新分支并创建 Pull Request</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              GitHub Token
              <span className="ml-1.5 text-gray-400 font-normal">（需 repo 权限）</span>
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={repoForm.repoToken}
                onChange={(e) => setRepoForm((f) => ({ ...f, repoToken: e.target.value }))}
                placeholder={project?.repoToken ? '已配置（输入新值可覆盖）' : 'ghp_xxxxxxxxxxxx'}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              留空则回退到后端 <code className="bg-gray-100 px-1 rounded">.env</code> 中的全局 GITHUB_TOKEN
            </p>
          </div>
        </div>
        <div className="px-5 py-3 flex justify-end">
          <button
            onClick={saveRepo}
            disabled={savingRepo || !project}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {savingRepo ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {savingRepo ? '保存中…' : '保存'}
          </button>
        </div>
      </div>

      {/* Analysis Config */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        <div className="px-5 py-4 flex items-center gap-2">
          <Info size={14} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">分析配置</h2>
        </div>

        {/* sourcemapVersion */}
        <div className="p-6">
          <div className="flex items-start gap-3 mb-3">
            <Tag size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-800">默认 Source Map 版本</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                与上传 .map 文件时填写的 <code className="bg-gray-100 px-1 rounded">version</code> 完全一致。<br />
                可以是 git commit short-sha（如 <code className="bg-gray-100 px-1 rounded">abc1234</code>）、
                语义版本号（<code className="bg-gray-100 px-1 rounded">v1.2.3</code>）或 <code className="bg-gray-100 px-1 rounded">latest</code>。
              </p>
            </div>
          </div>
          <input
            type="text"
            value={form.sourcemapVersion}
            onChange={(e) => setForm((f) => ({ ...f, sourcemapVersion: e.target.value }))}
            placeholder="latest"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
        </div>

        {/* sourcemapDir */}
        <div className="p-6">
          <div className="flex items-start gap-3 mb-3">
            <FolderOpen size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-800">Source Map 存储目录</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                后端服务器上存放 .map 文件的目录（绝对路径或相对路径）。<br />
                留空则使用后端 <code className="bg-gray-100 px-1 rounded">.env</code> 中的全局 <code className="bg-gray-100 px-1 rounded">SOURCEMAP_DIR</code>。
              </p>
            </div>
          </div>
          <input
            type="text"
            value={form.sourcemapDir}
            onChange={(e) => setForm((f) => ({ ...f, sourcemapDir: e.target.value }))}
            placeholder="留空使用全局 SOURCEMAP_DIR"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
        </div>

        {/* sourceRoot */}
        <div className="p-6">
          <div className="flex items-start gap-3 mb-3">
            <Code2 size={16} className="text-purple-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-800">
                源码根目录
                <span className="ml-2 text-xs font-normal text-green-600 bg-green-50 px-1.5 py-0.5 rounded">推荐配置</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                后端机器上项目源码的根目录（绝对路径）。<br />
                配置后 AI 分析会直接读取源码定位出错行，并支持触发 auto-apply 自动修复。
              </p>
            </div>
          </div>
          <input
            type="text"
            value={form.sourceRoot}
            onChange={(e) => setForm((f) => ({ ...f, sourceRoot: e.target.value }))}
            placeholder="例：/Users/you/projects/my-app"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
          />
        </div>

        {/* RAG Index */}
        <div className="p-6">
          <div className="flex items-start gap-3 mb-3">
            <Database size={16} className="text-indigo-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-800">
                RAG 源码索引
                <span className="ml-2 text-xs font-normal text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">需要 ChromaDB</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                扫描 sourceRoot 目录下的所有 .ts/.tsx 文件，将代码块批量写入向量数据库，供 AI 语义检索。<br />
                需先保存 sourceRoot，且已启动 ChromaDB（<code className="bg-gray-100 px-1 rounded">docker run -p 8000:8000 chromadb/chroma</code>）。
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={indexSource}
              disabled={indexing || !form.sourceRoot}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {indexing ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
              {indexing ? '索引中…' : '索引源代码'}
            </button>
            {indexResult && (
              <span className="text-xs text-gray-500">
                扫描 {indexResult.files} 个文件 · 写入 {indexResult.indexed} 个代码块
                {indexResult.skipped > 0 && ` · 跳过 ${indexResult.skipped} 个`}
              </span>
            )}
            {!form.sourceRoot && (
              <span className="text-xs text-amber-500">请先填写并保存 sourceRoot</span>
            )}
          </div>
        </div>

        {/* Save button */}
        <div className="p-5 flex justify-end">
          <button
            onClick={save}
            disabled={saving || !project}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            <Save size={14} />
            {saving ? '保存中…' : '保存分析配置'}
          </button>
        </div>
      </div>

      {/* Quick guide */}
      <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-5">
        <p className="text-sm font-semibold text-blue-800 mb-3">快速接入指南</p>
        <ol className="text-xs text-blue-700 space-y-2 list-decimal list-inside leading-relaxed">
          <li>在项目根目录执行 <code className="bg-blue-100 px-1 rounded">pnpm build</code> 生成含 .map 的产物</li>
          <li>
            执行上传脚本：
            <pre className="bg-blue-100 rounded p-2 mt-1 font-mono text-xs whitespace-pre-wrap">
{`VERSION=<git-short-sha> APP_ID=${appId} pnpm upload-maps`}
            </pre>
          </li>
          <li>将上面的 <code className="bg-blue-100 px-1 rounded">VERSION</code> 值填入「默认 Source Map 版本」并保存</li>
          <li>在错误详情页点击「AI 根因分析」，堆栈将自动还原为源码位置</li>
        </ol>
      </div>

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">确认删除项目</h2>
                <p className="text-xs text-gray-400">此操作不可撤销</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              将删除项目 <strong>{project?.name}</strong>（<code className="bg-gray-100 px-1 rounded font-mono">{appId}</code>）。
            </p>
            <p className="text-xs text-amber-600 mb-5">注意：相关错误记录不会被一并删除。</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={deleteProject}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
              >
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {deleting ? '删除中…' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
