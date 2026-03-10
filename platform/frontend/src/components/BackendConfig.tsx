import { useState, useEffect } from 'react'
import { Server, X, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react'
import { getApiBase, setApiBase } from '../lib/api'
import axios from 'axios'

interface Props {
  onClose?: () => void
}

export default function BackendConfig({ onClose }: Props) {
  const [url, setUrl] = useState(getApiBase() || 'http://localhost:4000')
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<'ok' | 'fail' | null>(null)

  const test = async () => {
    setTesting(true)
    setResult(null)
    try {
      const base = url.replace(/\/$/, '')
      await axios.get(`${base}/api/projects`, { timeout: 5000 })
      setResult('ok')
    } catch {
      setResult('fail')
    } finally {
      setTesting(false)
    }
  }

  const save = () => {
    setApiBase(url)
    onClose?.()
    window.location.reload()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Server size={18} className="text-blue-500" />
            <span className="font-semibold text-gray-800">配置后端地址</span>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-500 leading-relaxed">
            监控平台需要连接后端 API。本地后端地址通常为
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs mx-1">http://localhost:4000</code>
            ，配置后保存在浏览器 localStorage 中。
          </p>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">后端地址</label>
            <input
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setResult(null) }}
              placeholder="http://localhost:4000"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Mixed content warning */}
          {url.startsWith('http://') && window.location.protocol === 'https:' && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>
                当前页面为 HTTPS，调用 HTTP 后端会被浏览器混合内容策略拦截。
                <br />
                建议在浏览器地址栏点击锁形图标 → <strong>允许不安全内容</strong>，
                或直接在本地访问{' '}
                <a
                  href="http://localhost:5173"
                  target="_blank"
                  rel="noreferrer"
                  className="underline inline-flex items-center gap-0.5"
                >
                  localhost:5173 <ExternalLink size={10} />
                </a>
              </span>
            </div>
          )}

          {/* Test result */}
          {result === 'ok' && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 size={16} /> 连接成功！
            </div>
          )}
          {result === 'fail' && (
            <div className="flex items-center gap-2 text-sm text-red-500">
              <AlertCircle size={16} /> 连接失败，请确认后端已启动且地址正确
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button
            onClick={test}
            disabled={testing}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {testing ? '测试中…' : '测试连接'}
          </button>
          <button
            onClick={save}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            保存并刷新
          </button>
        </div>
      </div>
    </div>
  )
}

/** 用于检测是否需要显示配置弹窗的钩子 */
export function useBackendConfigNeeded() {
  const [needed, setNeeded] = useState(false)

  useEffect(() => {
    // 非本地开发时（Vite proxy 不可用）且没有配置后端地址，弹出引导
    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    const hasConfig = !!localStorage.getItem('MONITOR_API_BASE') || !!import.meta.env.VITE_API_BASE
    if (!isLocalDev && !hasConfig) {
      setNeeded(true)
    }
  }, [])

  return [needed, setNeeded] as const
}
