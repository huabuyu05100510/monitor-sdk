import './eventCapture'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { init } from '@monit/browser'
import { setErrorBoundaryContext } from '@monit/react'
import type { MonitorContext } from '@monit/browser'
import App from './App'
import ErrorLab from './pages/ErrorLab'

// Capture ctx from plugins so MonitorErrorBoundary can report React errors
const ctxCapturePlugin = {
  name: 'ctx-capture',
  setup(ctx: MonitorContext) {
    setErrorBoundaryContext(ctx)
  },
}

// DSN priority: localStorage (runtime) > VITE_DSN (build-time) > local default
// || instead of ?? so empty string also falls through to next option
const dsn =
  localStorage.getItem('MONITOR_DSN') ||
  import.meta.env.VITE_DSN ||
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
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/lab" element={<ErrorLab />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
)
