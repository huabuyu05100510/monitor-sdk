import { useEffect, useRef, useState } from 'react'
import type { MonitorEvent } from '@monit/browser'
import { onCapturedEvents } from './eventCapture'

const TYPE_COLORS: Record<string, string> = {
  error: '#f56c6c',
  request: '#e6a23c',
  'white-screen': '#909399',
}

const SUBTYPE_LABELS: Record<string, string> = {
  js: 'JS 错误',
  promise: 'Promise 错误',
  resource: '资源错误',
  react: 'React 错误',
  xhr: 'XHR 请求',
  fetch: 'Fetch 请求',
  'white-screen': '白屏检测',
}

interface EventItemProps {
  event: MonitorEvent
  index: number
}

function EventItem({ event, index }: EventItemProps) {
  const [expanded, setExpanded] = useState(false)
  const color = TYPE_COLORS[event.type] ?? '#909399'
  const label = SUBTYPE_LABELS[event.subType] ?? event.subType
  const time = new Date(event.timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${color}33`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
        marginBottom: 8,
        overflow: 'hidden',
      }}
    >
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            background: color,
            color: '#fff',
            borderRadius: 4,
            padding: '2px 7px',
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: 12, color: '#606266', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {(event.payload.message as string) ?? (event.payload.url as string) ?? event.subType}
        </span>
        <span style={{ fontSize: 11, color: '#909399', whiteSpace: 'nowrap' }}>
          #{index + 1} · {time}
        </span>
        <span style={{ color: '#c0c4cc', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <pre
          style={{
            margin: 0,
            padding: '8px 12px',
            background: '#f9f9f9',
            borderTop: `1px solid ${color}22`,
            fontSize: 12,
            overflow: 'auto',
            maxHeight: 260,
            color: '#303133',
          }}
        >
          {JSON.stringify(event, null, 2)}
        </pre>
      )}
    </div>
  )
}

export default function EventLog() {
  const [events, setEvents] = useState<MonitorEvent[]>([])
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return onCapturedEvents((incoming) => {
      setEvents((prev) => [...incoming, ...prev])
    })
  }, [])

  return (
    <div
      style={{
        marginTop: 32,
        background: '#f5f7fa',
        borderRadius: 8,
        padding: 16,
        border: '1px solid #e4e7ed',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, color: '#303133' }}>
          上报事件日志
          <span
            style={{
              marginLeft: 8,
              background: events.length > 0 ? '#f56c6c' : '#909399',
              color: '#fff',
              borderRadius: 10,
              padding: '1px 7px',
              fontSize: 12,
            }}
          >
            {events.length}
          </span>
        </h3>
        {events.length > 0 && (
          <button
            onClick={() => setEvents([])}
            style={{
              background: 'none',
              border: '1px solid #dcdfe6',
              borderRadius: 4,
              padding: '3px 10px',
              fontSize: 12,
              color: '#909399',
              cursor: 'pointer',
            }}
          >
            清空
          </button>
        )}
      </div>
      <div ref={listRef} style={{ maxHeight: 400, overflowY: 'auto' }}>
        {events.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: '#c0c4cc',
              padding: '32px 0',
              fontSize: 14,
            }}
          >
            暂无事件，点击上方按钮触发监控
          </div>
        ) : (
          events.map((e, i) => <EventItem key={`${e.timestamp}-${i}`} event={e} index={events.length - 1 - i} />)
        )}
      </div>
    </div>
  )
}
