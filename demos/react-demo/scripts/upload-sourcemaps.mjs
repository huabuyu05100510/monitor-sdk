/**
 * Upload all .map files from the build output to the Monitor Platform backend.
 *
 * Environment variables (all optional, have defaults):
 *   PLATFORM_API   Backend base URL  (default: http://localhost:4000/api)
 *   APP_ID         appId to attach   (default: react-demo)
 *   VERSION        Build version     (default: git short-sha, falls back to "latest")
 *   DIST_DIR       Build output dir  (default: ./dist)
 */

import { readFile, readdir } from 'fs/promises'
import { join, basename, extname } from 'path'
import { execSync } from 'child_process'

// ── Config ────────────────────────────────────────────────────────────────
const API_BASE  = process.env.PLATFORM_API ?? 'http://localhost:4000/api'
const APP_ID    = process.env.APP_ID       ?? 'react-demo'
const DIST_DIR  = process.env.DIST_DIR     ?? './dist'

function getVersion() {
  if (process.env.VERSION) return process.env.VERSION
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return 'latest'
  }
}

const VERSION = getVersion()

// ── Helpers ───────────────────────────────────────────────────────────────
async function findMapFiles(dir) {
  const maps = []
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      maps.push(...(await findMapFiles(full)))
    } else if (extname(e.name) === '.map') {
      maps.push(full)
    }
  }
  return maps
}

async function upload(mapPath) {
  // filename without .map → e.g. "index-DthvKruL.js"
  const filename = basename(mapPath, '.map')
  const buffer   = await readFile(mapPath)

  const form = new FormData()
  form.append('appId',    APP_ID)
  form.append('version',  VERSION)
  form.append('filename', filename)
  form.append('map', new Blob([buffer], { type: 'application/json' }), basename(mapPath))

  const res = await fetch(`${API_BASE}/sourcemaps/upload`, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

// ── Main ──────────────────────────────────────────────────────────────────
console.log(`\n📦  Uploading source maps`)
console.log(`    appId   : ${APP_ID}`)
console.log(`    version : ${VERSION}`)
console.log(`    distDir : ${DIST_DIR}`)
console.log(`    backend : ${API_BASE}\n`)

const maps = await findMapFiles(DIST_DIR)

if (maps.length === 0) {
  console.error('❌  No .map files found in', DIST_DIR)
  console.error('    Run "pnpm build" first, then retry.')
  process.exit(1)
}

let ok = 0, fail = 0
for (const mapPath of maps) {
  const name = basename(mapPath)
  try {
    await upload(mapPath)
    console.log(`  ✓  ${name}`)
    ok++
  } catch (err) {
    console.error(`  ✗  ${name}  →  ${err.message}`)
    fail++
  }
}

console.log(`\n${ok} uploaded, ${fail} failed`)

if (fail > 0) process.exit(1)

// Print the version so CI can capture it and embed it in the deploy
console.log(`\n🔑  Use version="${VERSION}" when triggering AI analysis`)
