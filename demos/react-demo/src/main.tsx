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

init({
  appId: 'react-demo',
  // Points to the Monitor Platform backend's report endpoint
  dsn: 'http://localhost:4000/api/errors/report',
  // Flush quickly so events show up in the log right away
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
