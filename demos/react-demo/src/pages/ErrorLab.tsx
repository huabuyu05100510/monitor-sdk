import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { MonitorErrorBoundary } from '@monit/react'

// ── 各类真实错误场景 ──────────────────────────────────────────────────────────

/** 场景 1：访问 null 对象属性 */
function scene_nullRef() {
  const user = null as unknown as { name: string }
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  user.name // TypeError: Cannot read properties of null
}

/** 场景 2：数组越界 + 链式调用 */
function scene_arrayChain() {
  const list: string[] = []
  list[99].toUpperCase() // TypeError: Cannot read properties of undefined
}

/** 场景 3：JSON.parse 非法字符串 */
function scene_jsonParse() {
  JSON.parse('{ bad json }') // SyntaxError
}

/** 场景 4：深层递归导致堆栈溢出 */
function scene_stackOverflow() {
  function recurse(n: number): number {
    return recurse(n + 1)
  }
  recurse(0) // RangeError: Maximum call stack size exceeded
}

/** 场景 5：类型断言引发的运行时错误 */
function scene_typeAssertion() {
  const data = { value: '42' } as unknown as { value: { toFixed: () => string } }
  data.value.toFixed() // TypeError
}

/** 场景 6：异步 reject 链未捕获 */
function scene_asyncReject() {
  async function fetchUser(id: number) {
    if (id < 0) throw new Error(`用户 ID 无效：${id}`)
    return { id, name: 'Alice' }
  }
  fetchUser(-1) // unhandledrejection
}

/** 场景 7：动态导入不存在的模块（用绝对 URL 避免构建报错）*/
function scene_dynamicImport() {
  // Use an absolute URL so Vite won't try to bundle it at compile time
  const fakeUrl = window.location.origin + '/non-existent-chunk-abc123.js'
  import(/* @vite-ignore */ fakeUrl).catch(() => {
    Promise.reject(new Error('动态模块加载失败：chunk 不存在或版本过期'))
  })
}

/** 场景 8：fetch 请求超时（手动 AbortController）*/
async function scene_fetchTimeout() {
  const controller = new AbortController()
  const tid = setTimeout(() => controller.abort(), 50)
  try {
    await fetch('https://httpbin.org/delay/10', { signal: controller.signal })
  } catch (e) {
    clearTimeout(tid)
    throw new Error(`网络请求超时：${(e as Error).message}`)
  }
}

/** 场景 9：XHR 状态码 500 */
function scene_xhr500() {
  const xhr = new XMLHttpRequest()
  xhr.open('GET', 'https://httpbin.org/status/500')
  xhr.onload = () => {
    if (xhr.status >= 500) {
      throw new Error(`XHR 服务器错误：HTTP ${xhr.status}`)
    }
  }
  xhr.send()
}

/** 场景 10：React 组件在 useEffect 中抛出（由 ErrorBoundary 捕获不了，走 window.onerror）*/
function SceneUseEffectCrash() {
  useEffect(() => {
    setTimeout(() => {
      throw new Error('useEffect 内部异步错误：组件已挂载后崩溃')
    }, 100)
  }, [])
  return <span style={{ color: '#67c23a', fontSize: 13 }}>已触发（100ms 后报错）</span>
}

/** 场景 11：React 渲染时崩溃（ErrorBoundary 捕获）*/
function SceneRenderCrash({ active }: { active: boolean }) {
  if (active) {
    const arr = null as unknown as string[]
    return <div>{arr.join(', ')}</div>
  }
  return <span style={{ color: '#67c23a', fontSize: 13 }}>组件正常渲染</span>
}

/** 场景 12：无限循环导致页面卡死（带保护）*/
function scene_infiniteLoop() {
  const start = Date.now()
  // 只跑 200ms，否则页面真的卡死
  // eslint-disable-next-line no-empty
  while (Date.now() - start < 200) {}
  throw new Error('检测到无限循环（模拟 200ms 阻塞后抛出）')
}

// ── 工具类型 ────────────────────────────────────────────────────────────────

type SceneDef = {
  id: string
  category: string
  title: string
  desc: string
  color: string
  action: () => void
  isReact?: boolean
}

// ── 主页面 ───────────────────────────────────────────────────────────────────

export default function ErrorLab() {
  const [log, setLog] = useState<{ id: string; time: string; msg: string }[]>([])
  const [effectCrash, setEffectCrash] = useState(false)
  const [renderCrash, setRenderCrash] = useState(false)
  const [boundaryKey, setBoundaryKey] = useState(0)
  const logRef = useRef<HTMLDivElement>(null)

  const addLog = (id: string, msg: string) => {
    const time = new Date().toLocaleTimeString()
    setLog(prev => [{ id, time, msg }, ...prev].slice(0, 30))
  }

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0
  }, [log])

  const trigger = (scene: SceneDef) => {
    addLog(scene.id, `触发：${scene.title}`)
    try {
      scene.action()
    } catch (e) {
      // For sync errors outside setTimeout, re-throw so window.onerror catches
      setTimeout(() => { throw e }, 0)
    }
  }

  const scenes: SceneDef[] = [
    {
      id: 'null-ref',
      category: 'TypeError',
      title: 'Null 引用',
      desc: '访问 null 对象的属性 —— 最常见的运行时错误',
      color: '#f56c6c',
      action: scene_nullRef,
    },
    {
      id: 'array-chain',
      category: 'TypeError',
      title: '数组越界链式调用',
      desc: '访问越界索引后继续调用方法',
      color: '#f56c6c',
      action: scene_arrayChain,
    },
    {
      id: 'type-assert',
      category: 'TypeError',
      title: '错误类型断言',
      desc: 'TypeScript 类型断言掩盖的运行时错误',
      color: '#f56c6c',
      action: scene_typeAssertion,
    },
    {
      id: 'json-parse',
      category: 'SyntaxError',
      title: 'JSON 解析失败',
      desc: 'JSON.parse 传入非法字符串',
      color: '#e6a23c',
      action: scene_jsonParse,
    },
    {
      id: 'stack-overflow',
      category: 'RangeError',
      title: '堆栈溢出',
      desc: '无限递归导致 Maximum call stack exceeded',
      color: '#e6a23c',
      action: scene_stackOverflow,
    },
    {
      id: 'infinite-loop',
      category: 'RangeError',
      title: '无限循环（模拟）',
      desc: '200ms 阻塞后抛出，模拟长任务卡死',
      color: '#e6a23c',
      action: scene_infiniteLoop,
    },
    {
      id: 'async-reject',
      category: 'Promise',
      title: '未捕获的异步拒绝',
      desc: 'async 函数 throw —— unhandledrejection',
      color: '#9b59b6',
      action: scene_asyncReject,
    },
    {
      id: 'dynamic-import',
      category: 'Promise',
      title: '动态模块加载失败',
      desc: '导入不存在的模块 —— 模拟动态路由加载失败',
      color: '#9b59b6',
      action: scene_dynamicImport,
    },
    {
      id: 'fetch-timeout',
      category: 'Network',
      title: 'Fetch 超时中断',
      desc: 'AbortController 50ms 后取消请求',
      color: '#409eff',
      action: scene_fetchTimeout,
    },
    {
      id: 'xhr-500',
      category: 'Network',
      title: 'XHR 服务端 500',
      desc: '请求返回 HTTP 500，onload 中抛出',
      color: '#409eff',
      action: scene_xhr500,
    },
    {
      id: 'use-effect-crash',
      category: 'React',
      title: 'useEffect 异步崩溃',
      desc: 'useEffect 内 setTimeout 抛出，ErrorBoundary 无法捕获',
      color: '#f5365c',
      action: () => setEffectCrash(true),
      isReact: true,
    },
    {
      id: 'render-crash',
      category: 'React',
      title: 'render 阶段崩溃',
      desc: '组件渲染时访问 null，被 ErrorBoundary 捕获',
      color: '#f5365c',
      action: () => setRenderCrash(true),
      isReact: true,
    },
  ]

  const categories = ['TypeError', 'SyntaxError', 'RangeError', 'Promise', 'Network', 'React']
  const categoryColors: Record<string, string> = {
    TypeError: '#fef0f0',
    SyntaxError: '#fdf6ec',
    RangeError: '#fdf6ec',
    Promise: '#f0f0fe',
    Network: '#ecf5ff',
    React: '#fff0f3',
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f0f2f5',
      padding: '28px 24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxSizing: 'border-box',
    }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: 22, color: '#303133', fontWeight: 700 }}>
              🧪 错误场景实验室
            </h1>
            <p style={{ margin: 0, color: '#909399', fontSize: 13 }}>
              点击场景卡片触发真实错误，通过监控平台进行 AI 根因分析
            </p>
          </div>
          <Link to="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            color: '#606266', fontSize: 13, textDecoration: 'none',
            border: '1px solid #dcdfe6', borderRadius: 6, padding: '6px 12px',
            background: '#fff',
          }}>
            ← 返回 Demo
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
          {/* Left: Scene Cards */}
          <div>
            {categories.map(cat => {
              const catScenes = scenes.filter(s => s.category === cat)
              return (
                <div key={cat} style={{
                  background: '#fff',
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 16,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}>
                  <div style={{
                    display: 'inline-block', fontSize: 11, fontWeight: 600,
                    padding: '2px 8px', borderRadius: 4, marginBottom: 12,
                    background: categoryColors[cat] ?? '#f5f5f5', color: '#606266',
                  }}>
                    {cat}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {catScenes.map(scene => (
                      <div key={scene.id}>
                        {/* useEffect 崩溃：挂载组件后自动触发 */}
                        {scene.id === 'use-effect-crash' && effectCrash && (
                          <SceneUseEffectCrash />
                        )}
                        {/* render 崩溃：用 ErrorBoundary 包裹 */}
                        {scene.id === 'render-crash' && (
                          <div style={{ marginBottom: 6 }}>
                            <MonitorErrorBoundary
                              key={boundaryKey}
                              fallback={
                                <div style={{
                                  background: '#fef0f0', border: '1px solid #fde2e2',
                                  borderRadius: 6, padding: '8px 12px', color: '#f56c6c', fontSize: 12,
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                }}>
                                  <span>⚠ 渲染崩溃已被 ErrorBoundary 捕获</span>
                                  <button onClick={() => { setRenderCrash(false); setBoundaryKey(k => k + 1) }}
                                    style={{ background: '#67c23a', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>
                                    重置
                                  </button>
                                </div>
                              }
                            >
                              <SceneRenderCrash active={renderCrash} />
                            </MonitorErrorBoundary>
                          </div>
                        )}
                        <button
                          onClick={() => trigger(scene)}
                          style={{
                            width: '100%', textAlign: 'left',
                            background: 'transparent', border: '1px solid #ebeef5',
                            borderRadius: 8, padding: '10px 14px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 12,
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => {
                            const el = e.currentTarget
                            el.style.borderColor = scene.color
                            el.style.background = scene.color + '0d'
                          }}
                          onMouseLeave={e => {
                            const el = e.currentTarget
                            el.style.borderColor = '#ebeef5'
                            el.style.background = 'transparent'
                          }}
                        >
                          <div style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: scene.color, flexShrink: 0,
                          }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#303133', marginBottom: 2 }}>
                              {scene.title}
                            </div>
                            <div style={{ fontSize: 11, color: '#909399', lineHeight: 1.4 }}>
                              {scene.desc}
                            </div>
                          </div>
                          <span style={{
                            fontSize: 11, color: scene.color,
                            border: `1px solid ${scene.color}33`,
                            borderRadius: 4, padding: '2px 6px', flexShrink: 0,
                          }}>
                            触发
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Right: Trigger Log */}
          <div style={{
            background: '#1a1a2e', borderRadius: 10, padding: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)', position: 'sticky', top: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: '#c9d1d9', fontSize: 13, fontWeight: 600 }}>触发日志</span>
              {log.length > 0 && (
                <button onClick={() => setLog([])}
                  style={{ background: 'none', border: 'none', color: '#6e7681', fontSize: 11, cursor: 'pointer' }}>
                  清空
                </button>
              )}
            </div>
            <div ref={logRef} style={{ height: 420, overflowY: 'auto' }}>
              {log.length === 0 ? (
                <div style={{ color: '#484f58', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
                  点击场景卡片触发错误
                </div>
              ) : (
                log.map((entry, i) => (
                  <div key={i} style={{
                    borderBottom: '1px solid #21262d', paddingBottom: 8, marginBottom: 8,
                  }}>
                    <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>{entry.time}</div>
                    <div style={{ fontSize: 12, color: '#c9d1d9', fontFamily: 'monospace' }}>
                      <span style={{ color: '#f85149' }}>[{entry.id}]</span>{' '}
                      {entry.msg}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div style={{
              marginTop: 12, padding: '8px 10px', background: '#0d1117',
              borderRadius: 6, fontSize: 11, color: '#6e7681', lineHeight: 1.5,
            }}>
              触发后在{' '}
              <span style={{ color: '#58a6ff' }}>localhost:5173</span>
              {' '}监控平台查看 AI 分析结果
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
