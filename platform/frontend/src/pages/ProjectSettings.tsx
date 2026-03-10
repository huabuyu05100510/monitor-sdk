import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Save, FolderOpen, Tag, Code2, CheckCircle2, AlertTriangle, Database, Loader2, RefreshCw } from 'lucide-react'
import { api, type Project } from '../lib/api'

export default function ProjectSettings() {
  const { appId } = useParams<{ appId: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [form, setForm] = useState({ sourcemapVersion: '', sourcemapDir: '', sourceRoot: '' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [indexing, setIndexing] = useState(false)
  const [indexResult, setIndexResult] = useState<{ files: number; indexed: number; skipped: number } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncOutput, setSyncOutput] = useState<string | null>(null)

  useEffect(() => {
    if (!appId) return
    api.get<Project[]>('/projects')
      .then(r => {
        const p = r.data.find(p => p.appId === appId)
        if (p) {
          setProject(p)
          setForm({
            sourcemapVersion: p.sourcemapVersion ?? 'latest',
            sourcemapDir: p.sourcemapDir ?? '',
            sourceRoot: p.sourceRoot ?? '',
          })
        }
      })
  }, [appId])

  const syncMaps = async () => {
    setSyncing(true)
    setSyncOutput(null)
    try {
      const r = await api.post<{ ok: boolean; output: string }>('/sourcemaps/sync')
      setSyncOutput(r.data.output || 'Already up to date.')
      setToast({ type: 'ok', msg: '同步完成' })
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'git pull 失败'
      setSyncOutput(msg)
      setToast({ type: 'err', msg })
    } finally {
      setSyncing(false)
      setTimeout(() => setToast(null), 4000)
    }
  }

  const indexSource = async () => {
    if (!appId) return
    setIndexing(true)
    setIndexResult(null)
    try {
      const r = await api.post<{ files: number; indexed: number; skipped: number }>(`/analysis/index-source/${appId}`)
      setIndexResult(r.data)
      setToast({ type: 'ok', msg: `索引完成：${r.data.indexed} 个代码块` })
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? '索引失败，请检查 sourceRoot 是否配置正确'
      setToast({ type: 'err', msg })
    } finally {
      setIndexing(false)
      setTimeout(() => setToast(null), 5000)
    }
  }

  const save = async () => {
    if (!project) return
    setSaving(true)
    try {
      await api.patch(`/projects/${project.id}`, {
        sourcemapVersion: form.sourcemapVersion || 'latest',
        sourcemapDir: form.sourcemapDir || null,
        sourceRoot: form.sourceRoot || null,
      })
      setToast({ type: 'ok', msg: '保存成功' })
    } catch {
      setToast({ type: 'err', msg: '保存失败，请重试' })
    } finally {
      setSaving(false)
      setTimeout(() => setToast(null), 3000)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-5">
        <ArrowLeft size={14} /> 返回总览
      </Link>

      <h1 className="text-xl font-bold text-gray-900 mb-1">项目设置</h1>
      <p className="text-sm text-gray-400 mb-6">appId: <strong>{appId}</strong></p>

      {/* Sync banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5 mb-6">
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

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">

        {/* sourcemapVersion */}
        <div className="p-6">
          <div className="flex items-start gap-3 mb-3">
            <Tag size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-800">默认 Source Map 版本</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                与上传 .map 文件时填写的 <code className="bg-gray-100 px-1 rounded">version</code> 完全一致。<br />
                可以是 git commit short-sha（如 <code className="bg-gray-100 px-1 rounded">abc1234</code>）、
                语义版本号（<code className="bg-gray-100 px-1 rounded">v1.2.3</code>）或 <code className="bg-gray-100 px-1 rounded">latest</code>。<br />
                触发 AI 分析时若未手动指定版本，则自动使用此值。
              </p>
            </div>
          </div>
          <input
            type="text"
            value={form.sourcemapVersion}
            onChange={e => setForm(f => ({ ...f, sourcemapVersion: e.target.value }))}
            placeholder="latest"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
          <p className="text-xs text-gray-400 mt-2">
            上传脚本示例：<code className="bg-gray-100 px-1 rounded">VERSION=abc1234 pnpm upload-maps</code>
          </p>
        </div>

        {/* sourcemapDir */}
        <div className="p-6">
          <div className="flex items-start gap-3 mb-3">
            <FolderOpen size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-800">Source Map 存储目录</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                后端服务器上存放 .map 文件的目录（绝对路径或相对于后端工作目录的相对路径）。<br />
                留空则使用后端 <code className="bg-gray-100 px-1 rounded">.env</code> 中的
                <code className="bg-gray-100 px-1 rounded ml-1">SOURCEMAP_DIR</code> 全局配置
                （当前默认：<code className="bg-gray-100 px-1 rounded">./uploads/sourcemaps</code>）。
              </p>
            </div>
          </div>
          <input
            type="text"
            value={form.sourcemapDir}
            onChange={e => setForm(f => ({ ...f, sourcemapDir: e.target.value }))}
            placeholder="留空使用全局 SOURCEMAP_DIR"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
          <p className="text-xs text-gray-400 mt-2">
            示例：<code className="bg-gray-100 px-1 rounded">/data/maps/my-app</code>
            &nbsp;或&nbsp;
            <code className="bg-gray-100 px-1 rounded">./uploads/sourcemaps</code>
          </p>
        </div>

        {/* sourceRoot */}
        <div className="p-6">
          <div className="flex items-start gap-3 mb-3">
            <Code2 size={16} className="text-purple-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-800">源码根目录 <span className="text-xs font-normal text-green-600 bg-green-50 px-1.5 py-0.5 rounded">推荐配置</span></p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                后端机器上项目源码的根目录（绝对路径）。<br />
                配置后，AI 分析会根据还原的堆栈帧（如 <code className="bg-gray-100 px-1 rounded">/src/App.tsx:86</code>）<br />
                直接读取该目录下的对应源码，定位到具体出错行，比 ChromaDB 检索更精准。
              </p>
            </div>
          </div>
          <input
            type="text"
            value={form.sourceRoot}
            onChange={e => setForm(f => ({ ...f, sourceRoot: e.target.value }))}
            placeholder="例：/Users/you/projects/my-app  或  留空不启用"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
          />
          <p className="text-xs text-gray-400 mt-2">
            对于本地开发，通常填写 demo 项目的根目录，例如：
            <code className="bg-gray-100 px-1 rounded ml-1">/Users/didi/Documents/code/monitor-sdk/demos/react-demo</code>
          </p>
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
                扫描 sourceRoot 目录下的所有 .ts/.tsx 文件，将代码块批量写入向量数据库。<br />
                建立索引后，AI 分析可通过语义搜索检索相关代码，作为直接文件读取的补充。<br />
                需先保存 sourceRoot，且本地已启动 ChromaDB（<code className="bg-gray-100 px-1 rounded">docker run -p 8000:8000 chromadb/chroma</code>）。
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
        <div className="p-5 flex items-center justify-between">
          <div>
            {toast && (
              <span className={`inline-flex items-center gap-1.5 text-sm ${toast.type === 'ok' ? 'text-green-600' : 'text-red-500'}`}>
                {toast.type === 'ok' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                {toast.msg}
              </span>
            )}
          </div>
          <button
            onClick={save}
            disabled={saving || !project}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            <Save size={14} />
            {saving ? '保存中…' : '保存设置'}
          </button>
        </div>
      </div>

      {/* Quick guide */}
      <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-5">
        <p className="text-sm font-semibold text-blue-800 mb-3">快速接入指南</p>
        <ol className="text-xs text-blue-700 space-y-2 list-decimal list-inside leading-relaxed">
          <li>在项目根目录执行 <code className="bg-blue-100 px-1 rounded">pnpm build</code> 生成含 .map 的产物</li>
          <li>
            执行上传脚本（以 react-demo 为例）：
            <pre className="bg-blue-100 rounded p-2 mt-1 font-mono text-xs whitespace-pre-wrap">
{`cd demos/react-demo
VERSION=<git-short-sha> APP_ID=${appId} pnpm upload-maps`}
            </pre>
          </li>
          <li>将上面的 <code className="bg-blue-100 px-1 rounded">VERSION</code> 值填入「默认 Source Map 版本」并保存</li>
          <li>在错误详情页点击「AI 根因分析」，堆栈将自动还原为源码位置</li>
        </ol>
      </div>
    </div>
  )
}
