/**
 * Upload .map files to the Monitor Platform backend.
 *
 * Two modes:
 *   1. Local build mode (default):
 *      Reads .map files from DIST_DIR and uploads them.
 *      Usage: pnpm upload-maps
 *
 *   2. GitHub Actions artifact mode (--from-github):
 *      Downloads the sourcemap artifact for the latest CI run (or a specific SHA),
 *      then uploads those .map files to the backend.
 *      Usage: pnpm upload-maps --from-github [--sha=<commit>]
 *      Requires: GITHUB_TOKEN env var (or gh CLI logged in)
 *
 * Environment variables:
 *   PLATFORM_API   Backend base URL  (default: http://localhost:4000/api)
 *   APP_ID         appId             (default: react-demo)
 *   VERSION        Build version     (default: git short-sha or "latest")
 *   DIST_DIR       Build output dir  (default: ./dist)
 *   GITHUB_TOKEN   GitHub PAT for artifact download (only needed with --from-github)
 *   GITHUB_REPO    owner/repo        (default: huabuyu05100510/monitor-sdk)
 */

import { readFile, readdir, mkdtemp, rm } from 'fs/promises'
import { join, basename, extname } from 'path'
import { execSync, execFileSync } from 'child_process'
import { tmpdir } from 'os'

// ── Config ────────────────────────────────────────────────────────────────
const API_BASE    = process.env.PLATFORM_API ?? 'http://localhost:4000/api'
const APP_ID      = process.env.APP_ID       ?? 'react-demo'
const DIST_DIR    = process.env.DIST_DIR     ?? './dist'
const GITHUB_REPO = process.env.GITHUB_REPO  ?? 'huabuyu05100510/monitor-sdk'

const FROM_GITHUB = process.argv.includes('--from-github')
const SHA_ARG     = process.argv.find(a => a.startsWith('--sha='))?.split('=')[1]

function getVersion() {
  if (process.env.VERSION) return process.env.VERSION
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return 'latest'
  }
}

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

async function upload(mapPath, version) {
  const filename = basename(mapPath, '.map')   // e.g. "index-CWrzxX1L.js"
  const buffer   = await readFile(mapPath)

  const form = new FormData()
  form.append('appId',    APP_ID)
  form.append('version',  version)
  form.append('filename', filename)
  form.append('map', new Blob([buffer], { type: 'application/json' }), basename(mapPath))

  const res = await fetch(`${API_BASE}/sourcemaps/upload`, { method: 'POST', body: form })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

// ── Mode 2: download artifact from GitHub Actions ─────────────────────────
async function downloadFromGitHub() {
  // Determine commit SHA
  const sha = SHA_ARG ?? execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim()
  const shortSha = sha.slice(0, 7)

  console.log(`\n🔍  Looking for sourcemap artifact for commit ${shortSha} in ${GITHUB_REPO}`)

  // Use gh CLI (pre-installed on most dev machines and GitHub Actions)
  let artifactId
  try {
    const listJson = execFileSync('gh', [
      'api', `repos/${GITHUB_REPO}/actions/artifacts`,
      '--jq', `.artifacts[] | select(.name | startswith("sourcemaps-${sha}")) | .id`,
    ], { encoding: 'utf-8' }).trim()

    // gh may return multiple lines; take first
    artifactId = listJson.split('\n').filter(Boolean)[0]
  } catch {
    // Fallback: try the short sha prefix
    try {
      const listJson = execFileSync('gh', [
        'api', `repos/${GITHUB_REPO}/actions/artifacts`,
        '--jq', `.artifacts[] | select(.name | startswith("sourcemaps-${shortSha}")) | .id`,
      ], { encoding: 'utf-8' }).trim()
      artifactId = listJson.split('\n').filter(Boolean)[0]
    } catch (e) {
      throw new Error(
        `Failed to list GitHub Actions artifacts. Make sure "gh" CLI is installed and you are logged in.\n${e.message}`
      )
    }
  }

  if (!artifactId) {
    throw new Error(
      `No artifact found for commit ${shortSha}.\n` +
      `Make sure the GitHub Actions workflow ran successfully for this commit.\n` +
      `You can also manually specify a commit: --sha=<full-sha>`
    )
  }

  console.log(`    Found artifact id: ${artifactId}`)

  // Download to a temp directory
  const tmpDir = await mkdtemp(join(tmpdir(), 'monitor-maps-'))
  try {
    execFileSync('gh', [
      'api', `repos/${GITHUB_REPO}/actions/artifacts/${artifactId}/zip`,
      '--header', 'Accept: application/vnd.github+json',
    ], { encoding: null, maxBuffer: 50 * 1024 * 1024 })

    // Unzip using system unzip
    const zipPath = join(tmpDir, 'maps.zip')
    execFileSync('gh', [
      'run', 'download',
      '--repo', GITHUB_REPO,
      '--name', `sourcemaps-${sha}`,
      '--dir', tmpDir,
    ])

    const maps = await findMapFiles(tmpDir)
    console.log(`    Downloaded ${maps.length} .map file(s) to ${tmpDir}\n`)
    return { maps, tmpDir, sha: shortSha }
  } catch {
    // gh run download is easier
    await rm(tmpDir, { recursive: true, force: true })
    const tmpDir2 = await mkdtemp(join(tmpdir(), 'monitor-maps-'))

    execFileSync('gh', [
      'run', 'download',
      '--repo', GITHUB_REPO,
      '--name', `sourcemaps-${sha}`,
      '--dir', tmpDir2,
    ], { stdio: 'inherit' })

    const maps = await findMapFiles(tmpDir2)
    console.log(`\n    Downloaded ${maps.length} .map file(s)\n`)
    return { maps, tmpDir: tmpDir2, sha: shortSha }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────
let maps, version, tmpDirToClean

if (FROM_GITHUB) {
  const result = await downloadFromGitHub()
  maps = result.maps
  version = process.env.VERSION ?? result.sha
  tmpDirToClean = result.tmpDir
} else {
  maps = await findMapFiles(DIST_DIR)
  version = getVersion()
}

console.log(`\n📦  Uploading source maps`)
console.log(`    appId   : ${APP_ID}`)
console.log(`    version : ${version}`)
console.log(`    backend : ${API_BASE}`)
console.log(`    files   : ${maps.length}\n`)

if (maps.length === 0) {
  if (FROM_GITHUB) {
    console.error('❌  No .map files found in downloaded artifact.')
  } else {
    console.error('❌  No .map files found in', DIST_DIR)
    console.error('    Run "pnpm build" first, or use --from-github to download from CI.')
  }
  process.exit(1)
}

let ok = 0, fail = 0
for (const mapPath of maps) {
  const name = basename(mapPath)
  try {
    await upload(mapPath, version)
    console.log(`  ✓  ${name}  (version=${version})`)
    ok++
  } catch (err) {
    console.error(`  ✗  ${name}  →  ${err.message}`)
    fail++
  }
}

// Also upload as "latest" so old errors also resolve
if (version !== 'latest' && ok > 0) {
  console.log(`\n  Uploading as "latest" alias...`)
  for (const mapPath of maps) {
    const name = basename(mapPath)
    try {
      await upload(mapPath, 'latest')
      console.log(`  ✓  ${name}  (version=latest)`)
      ok++
    } catch (err) {
      console.error(`  ✗  ${name}  (latest) →  ${err.message}`)
    }
  }
}

if (tmpDirToClean) await rm(tmpDirToClean, { recursive: true, force: true })

console.log(`\n${ok} uploaded, ${fail} failed`)
if (fail > 0) process.exit(1)

console.log(`\n🔑  Version "${version}" — use this when triggering AI analysis`)
console.log(`    Or leave blank to use the project's default sourcemapVersion.\n`)
