import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ConfigService } from '@nestjs/config'
import * as fs from 'fs'
import * as path from 'path'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SourceMapConsumer } = require('source-map-js')
import { Sourcemap } from './sourcemap.entity'

export interface ResolvedFrame {
  source: string | null
  line: number | null
  column: number | null
  name: string | null
  /** true if this frame was actually resolved via source map */
  resolved: boolean
}

export interface StackFrame {
  filename: string
  line: number
  column: number
}

@Injectable()
export class SourcemapsService {
  private readonly logger = new Logger(SourcemapsService.name)

  /** Global fallback base directory (from env / .env) */
  private readonly globalBaseDir: string

  constructor(
    @InjectRepository(Sourcemap)
    private readonly repo: Repository<Sourcemap>,
    private readonly config: ConfigService,
  ) {
    this.globalBaseDir = path.resolve(config.get('SOURCEMAP_DIR', './uploads/sourcemaps'))
    fs.mkdirSync(this.globalBaseDir, { recursive: true })
  }

  /**
   * Resolve the effective base directory for an app.
   * Priority: project.sourcemapDir > global SOURCEMAP_DIR env
   */
  resolveBaseDir(projectSourcemapDir?: string | null): string {
    if (projectSourcemapDir) {
      const dir = path.resolve(projectSourcemapDir)
      fs.mkdirSync(dir, { recursive: true })
      return dir
    }
    return this.globalBaseDir
  }

  /**
   * Save an uploaded .map file.
   * @param baseDir Optional per-project override (from Project.sourcemapDir)
   */
  async save(
    appId: string,
    version: string,
    filename: string,
    fileBuffer: Buffer,
    baseDir?: string | null,
  ): Promise<Sourcemap> {
    const root = this.resolveBaseDir(baseDir)
    const dir = path.join(root, appId, version)
    fs.mkdirSync(dir, { recursive: true })

    // Store as "filename.map" (the original JS bundle name + .map)
    const storagePath = path.join(dir, filename.endsWith('.map') ? filename : `${filename}.map`)
    fs.writeFileSync(storagePath, fileBuffer)

    let record = await this.repo.findOneBy({ appId, version, filename })
    if (record) {
      record.storagePath = storagePath
    } else {
      record = this.repo.create({ appId, version, filename, storagePath })
    }
    return this.repo.save(record)
  }

  async listByApp(appId: string): Promise<Sourcemap[]> {
    return this.repo.find({ where: { appId }, order: { createdAt: 'DESC' } })
  }

  /**
   * Resolve a single minified stack frame to its original source location.
   */
  async resolveFrame(appId: string, version: string, frame: StackFrame): Promise<ResolvedFrame> {
    // Detect Vite/Rollup production bundles by content-hash in filename.
    // Vite hashes are 8 chars from [a-zA-Z0-9_-], separated by [-_] from the base name.
    // Examples: index-f_wB0Uxy.js, main-Ab3xYZ12.js
    // Underscore can appear inside the hash, so old regex [.-][a-zA-Z0-9]{6,} was wrong.
    const basename = path.basename(frame.filename).split('?')[0]
    const isBundle = /[-_][a-zA-Z0-9_-]{6,}\.(js|mjs|cjs)$/.test(basename)

    // Dev server source files (e.g. http://localhost:3000/src/App.tsx) are already
    // pointing at the original source — no source map lookup needed.
    const isDevSourceFile = !isBundle && /\.(tsx?|jsx?)$/.test(frame.filename)
    if (isDevSourceFile) {
      // Strip the origin so the path is clean: "src/App.tsx:50:10"
      const cleanSource = frame.filename.replace(/^https?:\/\/[^/]+/, '')
      return { source: cleanSource, line: frame.line, column: frame.column, name: null, resolved: true }
    }

    const bundleFilename = basename // already stripped query string

    // DB lookup: try both "index-hash.js" and "index-hash.js.map" (upload may use either naming)
    const lookupNames = [bundleFilename, `${bundleFilename}.map`]
    let record: Sourcemap | null = null
    for (const name of lookupNames) {
      record = await this.repo.findOneBy({ appId, version, filename: name }) ?? null
      if (record) break
    }

    // Fall back to "latest" version so users don't have to re-upload for every dev build
    if (!record && version !== 'latest') {
      for (const name of lookupNames) {
        record = await this.repo.findOneBy({ appId, version: 'latest', filename: name }) ?? null
        if (record) {
          this.logger.debug(`Fell back to "latest" sourcemap for ${bundleFilename}`)
          break
        }
      }
    }

    if (!record) {
      this.logger.warn(
        `No sourcemap for ${appId}@${version} :: ${bundleFilename}. ` +
          'Upload via POST /api/sourcemaps/upload or run "pnpm upload-maps" in the demo.',
      )
      return { source: frame.filename, line: frame.line, column: frame.column, name: null, resolved: false }
    }

    try {
      const rawMap = fs.readFileSync(record.storagePath, 'utf-8')
      const consumer = new SourceMapConsumer(JSON.parse(rawMap))

      // source-map-js already does nearest-mapping lookup by default
      const pos = consumer.originalPositionFor({ line: frame.line, column: frame.column })

      if (!pos.source) {
        // This frame line has no mappings (e.g. Vite polyfill on line 1 — skip it)
        return { source: frame.filename, line: frame.line, column: frame.column, name: null, resolved: false }
      }

      // Normalize the resolved source path.
      // source-map-js returns raw values like "../../src/App.tsx".
      // Resolve against a virtual path so we get something clean like "src/App.tsx".
      let resolvedSource = pos.source as string
      if (resolvedSource.startsWith('../') || resolvedSource.startsWith('./')) {
        // Virtual base: the bundle lives at dist/assets/bundle.js
        // Source map sources are relative to that, so resolve them:
        resolvedSource = path.posix.normalize(
          path.posix.join('/dist/assets', resolvedSource),
        )
        // Trim leading "/dist/assets/../../" → clean path like "/src/App.tsx"
      }
      // Filter out node_modules after resolution
      if (resolvedSource.includes('node_modules')) {
        return { source: frame.filename, line: frame.line, column: frame.column, name: null, resolved: false }
      }

      return {
        source: resolvedSource,
        line: pos.line,
        column: pos.column,
        name: pos.name,
        resolved: true,
      }
    } catch (err) {
      this.logger.error(`Failed to parse sourcemap for ${bundleFilename}`, err)
      return { source: frame.filename, line: frame.line, column: frame.column, name: null, resolved: false }
    }
  }

  /**
   * Resolve a full error stack string (Chrome/Firefox format) to original positions.
   */
  async resolveStack(appId: string, version: string, stack: string): Promise<ResolvedFrame[]> {
    const frames = this.parseStack(stack)
    if (frames.length === 0) return []
    return Promise.all(frames.map((f) => this.resolveFrame(appId, version, f)))
  }

  // ── Stack parsing ──────────────────────────────────────────────────────

  parseStack(stack: string): StackFrame[] {
    const frames: StackFrame[] = []

    // Chrome/Node: "    at funcName (https://host/assets/index-abc.js:1:234)"
    // Chrome anon: "    at https://host/assets/index-abc.js:1:234"
    const chromeRe = /^\s+at (?:.+? \()?(.+?):(\d+):(\d+)\)?$/
    // Firefox:     "funcName@https://host/assets/index-abc.js:1:234"
    const firefoxRe = /^(?:.*@)?(.+?):(\d+):(\d+)$/

    for (const line of stack.split('\n')) {
      const m = chromeRe.exec(line) ?? firefoxRe.exec(line)
      if (m) {
        // Strip query strings from Vite dev URLs (e.g. ?v=abc123&t=456)
        const filename = m[1].replace(/\?[^:]*$/, '')
        // Skip non-JS/TS frames and internal runtime frames
        if (!filename.includes('.js') && !filename.includes('.ts')) continue
        if (filename.startsWith('node:') || filename === '<anonymous>') continue
        // Skip third-party/runtime frames — only resolve user source & production bundles
        if (filename.includes('/node_modules/')) continue
        if (filename.includes('/@fs/') && filename.includes('/node_modules/')) continue
        frames.push({ filename, line: Number(m[2]), column: Number(m[3]) })
      }
    }
    return frames
  }
}
