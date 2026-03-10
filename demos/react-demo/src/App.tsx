import { useState } from 'react'
import { MonitorErrorBoundary } from '@monit/react'
import EventLog from './EventLog'

// ── DSN 配置浮层 ─────────────────────────────────────────────────────────────
function DsnConfig() {
  const current = localStorage.getItem('MONITOR_DSN') || ''
  const [open, setOpen] = useState(false)
  const [val, setVal] = useState(current)
  const [saved, setSaved] = useState(false)

  const save = () => {
    if (val.trim()) {
      localStorage.setItem('MONITOR_DSN', val.trim())
    } else {
      localStorage.removeItem('MONITOR_DSN')
    }
    setSaved(true)
    setTimeout(() => { setOpen(false); setSaved(false); window.location.reload() }, 800)
  }

  const btnStyle: React.CSSProperties = {
    position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
    background: current ? '#409EFF' : '#e6a23c',
    color: '#fff', border: 'none', borderRadius: 20, padding: '6px 14px',
    cursor: 'pointer', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  }

  return (
    <>
      <button style={btnStyle} onClick={() => setOpen(o => !o)}>
        {current ? '📡 已配置上报' : '⚠️ 配置上报地址'}
      </button>

      {open && (
        <div style={{
          position: 'fixed', bottom: 52, right: 16, zIndex: 9999,
          background: '#fff', borderRadius: 10, padding: 16, width: 360,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)', fontSize: 13,
        }}>
          <p style={{ margin: '0 0 8px', fontWeight: 600 }}>上报地址 (DSN)</p>
          <p style={{ margin: '0 0 10px', color: '#666', fontSize: 11, lineHeight: 1.5 }}>
            填入 cloudflared 隧道地址，例如：<br />
            <code style={{ background: '#f5f5f5', padding: '2px 4px', borderRadius: 4 }}>
              https://xxx.trycloudflare.com/api/errors/report
            </code>
          </p>
          <input
            value={val}
            onChange={e => setVal(e.target.value)}
            placeholder="https://xxx.trycloudflare.com/api/errors/report"
            style={{
              width: '100%', boxSizing: 'border-box', border: '1px solid #ddd',
              borderRadius: 6, padding: '6px 8px', fontSize: 12, fontFamily: 'monospace',
            }}
          />
          <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setOpen(false)}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 12 }}>
              取消
            </button>
            <button onClick={save}
              style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#409EFF', color: '#fff', cursor: 'pointer', fontSize: 12 }}>
              {saved ? '✓ 已保存' : '保存并刷新'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Buggy component — throws during render when activated
// ---------------------------------------------------------------------------
function BuggyComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('React 组件渲染错误：props.shouldThrow = true')
  }
  return (
    <div style={{ color: '#67c23a', fontSize: 13 }}>
      组件渲染正常，点击「触发 React 组件错误」查看 ErrorBoundary 效果
    </div>
  )
}

// ---------------------------------------------------------------------------
// Trigger buttons
// ---------------------------------------------------------------------------
interface TriggerConfig {
  label: string
  description: string
  color: string
  action: () => void
}

function TriggerButton({ label, description, color, action }: TriggerConfig) {
  return (
    <button
      onClick={action}
      title={description}
      style={{
        background: color,
        color: '#fff',
        border: 'none',
        borderRadius: 6,
        padding: '10px 18px',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.opacity = '0.85')}
      onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.opacity = '1')}
    >
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
export default function App() {
  const [reactError, setReactError] = useState(false)
  const [boundaryKey, setBoundaryKey] = useState(0)

  const resetErrorBoundary = () => {
    setReactError(false)
    setBoundaryKey((k) => k + 1)
  }

  const triggers: TriggerConfig[] = [
    {
      label: '触发 JS 错误',
      description: 'window.onerror 捕获同步抛出的错误',
      color: '#f56c6c',
      action: () => {
        // Use setTimeout to escape React's event handler and reach window.onerror
        setTimeout(() => {
          throw new Error('手动触发的 JS 错误 —— window.onerror 捕获')
        }, 0)
      },
    },
    {
      label: '触发 Promise 错误',
      description: 'unhandledrejection 事件捕获未处理的 Promise 拒绝',
      color: '#e6a23c',
      action: () => {
        Promise.reject(new Error('手动触发的 Promise 拒绝 —— unhandledrejection 捕获'))
      },
    },
    {
      label: '触发 Fetch 失败',
      description: '请求一个不存在的地址，fetch 拦截器捕获网络错误',
      color: '#409eff',
      action: () => {
        fetch('http://localhost:19999/non-existent').catch(() => {})
      },
    },
    {
      label: '触发 XHR 失败',
      description: '通过 XMLHttpRequest 请求不存在的地址',
      color: '#9b59b6',
      action: () => {
        const xhr = new XMLHttpRequest()
        xhr.open('GET', 'http://localhost:19999/non-existent-xhr')
        xhr.send()
      },
    },
    {
      label: '触发 React 组件错误',
      description: 'MonitorErrorBoundary 捕获组件渲染时抛出的错误',
      color: '#f5365c',
      action: () => setReactError(true),
    },
    {
      label: '触发资源加载错误',
      description: '动态插入一个 src 不存在的 img 标签',
      color: '#909399',
      action: () => {
        const img = document.createElement('img')
        img.src = 'http://localhost:19999/non-existent-image.png'
        img.style.display = 'none'
        document.body.appendChild(img)
        setTimeout(() => {
          if (document.body.contains(img)) document.body.removeChild(img)
        }, 3000)
      },
    },
  ]

  // console.log(error1)
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f0f2f5',
        padding: '32px 24px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 24, color: '#303133', fontWeight: 700 }}>
            Monitor SDK — React Demo
          </h1>
          <p style={{ margin: 0, color: '#606266', fontSize: 14 }}>
            点击下方按钮触发各类监控事件，实时查看 SDK 的捕获与上报结果
          </p>
        </div>

        {/* Trigger Panel */}
        <div
          style={{
            background: '#fff',
            borderRadius: 8,
            padding: 20,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            marginBottom: 20,
          }}
        >
          <h2 style={{ margin: '0 0 16px', fontSize: 15, color: '#303133', fontWeight: 600 }}>
            触发监控事件
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {triggers.map((t) => (
              <TriggerButton key={t.label} {...t} />
            ))}
          </div>
        </div>

        {/* React Error Boundary Section */}
        <div
          style={{
            background: '#fff',
            borderRadius: 8,
            padding: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 15, color: '#303133', fontWeight: 600 }}>
              MonitorErrorBoundary
            </h2>
            {reactError && (
              <button
                onClick={resetErrorBoundary}
                style={{
                  background: '#67c23a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 12px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                重置组件
              </button>
            )}
          </div>
          <MonitorErrorBoundary
            key={boundaryKey}
            fallback={
              <div
                style={{
                  background: '#fef0f0',
                  border: '1px solid #fde2e2',
                  borderRadius: 6,
                  padding: '10px 14px',
                  color: '#f56c6c',
                  fontSize: 13,
                }}
              >
                ⚠ React 错误已被 ErrorBoundary 捕获，事件已上报至监控系统
              </div>
            }
          >
            <BuggyComponent shouldThrow={reactError} />
          </MonitorErrorBoundary>
        </div>

        {/* Event Log */}
        <div
          style={{
            background: '#fff',
            borderRadius: 8,
            padding: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <EventLog />
        </div>
      </div>

      {/* DSN 配置悬浮按钮 */}
      <DsnConfig />
    </div>
  )
}
