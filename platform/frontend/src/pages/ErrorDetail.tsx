import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import {
  ArrowLeft, Brain, Zap, FileCode, CheckCircle2,
  AlertTriangle, Loader2, ChevronDown, ChevronRight, Settings, GitPullRequest, GitBranch,
} from 'lucide-react'
import { errorsApi, analysisApi, type ErrorEvent, type AnalysisResult, type ApplyResult } from '../lib/api'
import { SubTypeBadge } from '../components/SubTypeBadge'
import { StatusBadge } from '../components/StatusBadge'

// ── Code block renderer used inside ReactMarkdown ─────────────────────────
function CodeBlock({
  language, children,
}: {
  language?: string
  children: string
}) {
  return (
    <SyntaxHighlighter
      language={language ?? 'typescript'}
      style={vscDarkPlus}
      customStyle={{ borderRadius: 8, fontSize: 13, margin: 0 }}
      showLineNumbers
    >
      {children}
    </SyntaxHighlighter>
  )
}

// ── Collapsible section ───────────────────────────────────────────────────
function Section({
  title, icon, defaultOpen = true, children,
}: {
  title: string
  icon: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        {icon}
        <span className="flex-1 font-semibold text-sm text-gray-800">{title}</span>
        {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
      </button>
      {open && <div className="border-t border-gray-100">{children}</div>}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function ErrorDetail() {
  const { id } = useParams<{ id: string }>()
  const [event, setEvent] = useState<ErrorEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [version, setVersion] = useState('')

  const fetchEvent = async () => {
    if (!id) return
    setLoading(true)
    const data = await errorsApi.get(id).catch(() => null)
    setEvent(data)
    setLoading(false)
  }

  useEffect(() => { fetchEvent() }, [id])

  const handleAnalyze = async () => {
    if (!id) return
    setAnalyzing(true)
    try {
      await analysisApi.analyze(id, version)
      await fetchEvent()
    } finally {
      setAnalyzing(false)
    }
  }

  const handleApply = async () => {
    if (!id) return
    setApplying(true)
    setApplyResult(null)
    setApplyError(null)
    try {
      const result = await analysisApi.apply(id)
      setApplyResult(result)
    } catch (e: any) {
      setApplyError(e?.response?.data?.message ?? '应用失败，请查看后端日志')
    } finally {
      setApplying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 className="animate-spin mr-2" size={18} />
        加载中…
      </div>
    )
  }

  if (!event) {
    return (
      <div className="p-6 text-center text-gray-400">
        错误事件不存在
        <Link to="/" className="block mt-2 text-blue-500 text-sm">返回首页</Link>
      </div>
    )
  }

  const analysis = event.analysis as AnalysisResult | null

  return (
    <div className="p-6 space-y-5">
      {/* Breadcrumb + Header */}
      <div>
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-3">
          <ArrowLeft size={14} />
          返回总览
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <SubTypeBadge subType={event.subType} />
              <StatusBadge status={event.status} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 break-all">
              {(event.payload.message as string) ?? `[${event.subType}]`}
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              appId: <strong>{event.appId}</strong> · {new Date(event.createdAt).toLocaleString('zh-CN')}
            </p>
          </div>

          {/* Analyze button */}
          <div className="flex-shrink-0 flex items-center gap-2">
            <Link
              to={`/settings/${event.appId}`}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-2 py-1.5"
              title="配置 Source Map 版本和存储路径"
            >
              <Settings size={12} /> 项目设置
            </Link>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="版本（空=项目默认）"
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-40 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleAnalyze}
              disabled={analyzing || event.status === 'analyzing'}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              title={`使用版本: ${version || '(项目默认)'}`}
            >
              {analyzing ? (
                <><Loader2 size={14} className="animate-spin" />分析中…</>
              ) : (
                <><Zap size={14} />AI 根因分析</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* LEFT — Raw info */}
        <div className="space-y-5">
          {/* Payload */}
          <Section title="原始错误信息" icon={<AlertTriangle size={14} className="text-red-400" />}>
            <div className="p-4">
              <pre className="text-xs bg-gray-950 text-green-300 rounded-lg p-4 overflow-auto max-h-64 leading-relaxed">
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            </div>
          </Section>

          {/* User context */}
          <Section title="用户上下文" icon={<FileCode size={14} className="text-gray-400" />}>
            <div className="p-4 space-y-2 text-xs text-gray-600">
              <InfoRow label="URL" value={event.url} />
              <InfoRow label="UA" value={event.userAgent} />
              <InfoRow label="时间戳" value={new Date(event.timestamp).toLocaleString('zh-CN')} />
            </div>
          </Section>

          {/* Resolved stack */}
          {analysis?.resolvedStack && analysis.resolvedStack.length > 0 && (
            <Section title="还原后的调用堆栈" icon={<FileCode size={14} className="text-purple-400" />}>
              <div className="p-4 overflow-auto max-h-80">
                {analysis.resolvedStack.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs py-1 border-b border-gray-50 last:border-0">
                    <span className="text-gray-300 w-4 text-right flex-shrink-0">{i + 1}</span>
                    <div>
                      <span className="text-blue-600 font-medium">{f.source ?? '(unknown)'}</span>
                      <span className="text-gray-400">
                        :{f.line}:{f.column}
                      </span>
                      {f.name && <span className="ml-2 text-gray-500 italic">{f.name}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* CENTER — AI Diagnosis + Related Code */}
        <div className="space-y-5">
          <Section title="AI 根因诊断" icon={<Brain size={14} className="text-blue-500" />}>
            {!analysis ? (
              <div className="p-6 text-center text-sm text-gray-400">
                点击右上角「AI 根因分析」按钮开始诊断
              </div>
            ) : analysis.error ? (
              <div className="p-4 text-sm text-red-500 bg-red-50 m-4 rounded-lg">
                分析失败：{analysis.error}
              </div>
            ) : (
              <div className="p-5 bg-blue-50 rounded-b-xl">
                <div className="prose prose-sm max-w-none text-gray-800">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ className, children }) {
                        const lang = className?.replace('language-', '')
                        return (
                          <CodeBlock language={lang}>
                            {String(children).replace(/\n$/, '')}
                          </CodeBlock>
                        )
                      },
                    }}
                  >
                    {analysis.diagnosis || '（未生成诊断内容）'}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </Section>

          {/* Related code from RAG */}
          {analysis?.relatedCode && analysis.relatedCode.length > 0 && (
            <Section title={`RAG 相关源码（${analysis.relatedCode.length} 片段）`} icon={<FileCode size={14} className="text-green-500" />}>
              <div className="p-4 space-y-3">
                {analysis.relatedCode.map((snippet, i) => (
                  <div key={i}>
                    <CodeBlock language="typescript">{snippet}</CodeBlock>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* RIGHT — Fix Suggestion + Review */}
        <div className="space-y-5">
          <Section title="AI 修复建议" icon={<Zap size={14} className="text-amber-500" />}>
            {!analysis?.suggestedFix ? (
              <div className="p-6 text-center text-sm text-gray-400">
                分析完成后将展示修复方案
              </div>
            ) : (
              <div>
                <div className="p-5">
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ className, children }) {
                          const lang = className?.replace('language-', '')
                          return (
                            <CodeBlock language={lang}>
                              {String(children).replace(/\n$/, '')}
                            </CodeBlock>
                          )
                        },
                      }}
                    >
                      {analysis.suggestedFix}
                    </ReactMarkdown>
                  </div>
                </div>

                {/* Apply Fix */}
                <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                  {!applyResult ? (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleApply}
                        disabled={applying}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                      >
                        {applying
                          ? <><Loader2 size={14} className="animate-spin" />应用中…</>
                          : <><GitPullRequest size={14} />应用修复并提 PR</>
                        }
                      </button>
                      <span className="text-xs text-gray-400">
                        自动写入源码 → 建分支 → commit → 向 master 提 PR
                      </span>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
                        <CheckCircle2 size={16} />
                        修复已提交
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <GitBranch size={12} className="text-gray-400" />
                        分支：<code className="bg-white border border-gray-200 px-1.5 py-0.5 rounded">{applyResult.branch}</code>
                      </div>
                      <div className="text-xs text-gray-600">
                        修改文件：{applyResult.files.join(', ')}
                      </div>
                      {applyResult.prUrl ? (
                        <a
                          href={applyResult.prUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <GitPullRequest size={12} />
                          查看 Pull Request
                        </a>
                      ) : (
                        <p className="text-xs text-amber-600">
                          分支已推送，PR 创建失败或已存在（可前往 GitHub 手动提 PR）
                        </p>
                      )}
                    </div>
                  )}
                  {applyError && (
                    <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {applyError}
                    </div>
                  )}
                </div>
              </div>
            )}
          </Section>

          {/* Review note */}
          {analysis?.reviewNote && (
            <Section title="代码审查意见" icon={<CheckCircle2 size={14} className="text-teal-500" />}>
              <div className="p-4 text-sm text-gray-700 leading-relaxed bg-teal-50 rounded-b-xl">
                {analysis.reviewNote}
              </div>
            </Section>
          )}

          {/* Warnings */}
          {analysis?.warnings && analysis.warnings.length > 0 && (
            <Section title="分析警告" icon={<AlertTriangle size={14} className="text-yellow-500" />}>
              <div className="p-4 space-y-1">
                {analysis.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1">{w}</p>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-400 flex-shrink-0 w-12">{label}</span>
      <span className="text-gray-600 break-all">{value}</span>
    </div>
  )
}
