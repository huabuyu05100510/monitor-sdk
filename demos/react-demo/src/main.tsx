import './eventCapture'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { init } from '@monit/browser'
import { setErrorBoundaryContext } from '@monit/react'
import type { MonitorContext } from '@monit/browser'
import App from './App'

// Capture ctx from plugins so MonitorErrorBoundary can report React errors
const ctxCapturePlugin = {
  name: 'ctx-capture',
  setup(ctx: MonitorContext) {
    setErrorBoundaryContext(ctx)
  },
}

// DSN priority: localStorage (runtime) > VITE_DSN (build-time) > local default
// Set via: localStorage.setItem('MONITOR_DSN', 'https://xxx.ngrok.io/api/errors/report')
const dsn =
  localStorage.getItem('MONITOR_DSN') ??
  import.meta.env.VITE_DSN ??
  'http://localhost:4000/api/errors/report'

init({
  appId: 'react-demo',
  dsn,
  maxQueueSize: 1,
  flushInterval: 200,
  plugins: [ctxCapturePlugin],
})

const root = document.getElementById('root')!
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
