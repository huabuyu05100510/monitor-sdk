import { Injectable, Logger } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'
import type { ResolvedFrame } from '../sourcemaps/sourcemaps.service'

export interface CodeSnippet {
  /** Relative or absolute source path */
  filePath: string
  /** 1-based line number where the error/frame occurred */
  errorLine: number
  /** The extracted source lines with line numbers */
  code: string
  /** Whether the file was successfully read */
  found: boolean
}

@Injectable()
export class CodeReaderService {
  private readonly logger = new Logger(CodeReaderService.name)

  /**
   * Recursively search sourceRoot for a file whose basename matches targetName.
   * Returns the first match, or null if not found.
   * Skips node_modules / dist / .git directories.
   */
  findFileByName(root: string, targetName: string): string | null {
    const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.cache', 'coverage', 'build'])
    const queue: string[] = [root]

    while (queue.length > 0) {
      const dir = queue.shift()!
      let entries: fs.Dirent[]
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true })
      } catch {
        continue
      }
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!SKIP_DIRS.has(entry.name)) queue.push(path.join(dir, entry.name))
        } else if (entry.name === targetName) {
          return path.join(dir, entry.name)
        }
      }
    }
    return null
  }

  /**
   * Given a list of resolved stack frames and a project source root,
   * extract ±contextLines of source code around each frame.
   *
   * Resolution order for each frame:
   *  1. Exact path: sourceRoot + frame.source (e.g. /src/pages/ErrorLab.tsx)
   *  2. Fuzzy match: recursively search sourceRoot for a file named frame.source's basename
   */
  extractSnippets(
    frames: ResolvedFrame[],
    sourceRoot: string,
    contextLines = 30,
  ): CodeSnippet[] {
    const resolvedRoot = path.resolve(sourceRoot)
    const seen = new Set<string>()
    const snippets: CodeSnippet[] = []

    for (const frame of frames) {
      if (!frame.resolved || !frame.source || frame.line == null) continue

      // Skip frames that still point at production bundle files (unresolved by source map).
      const looksLikeBundle = /[._-][a-zA-Z0-9_-]{6,}\.(js|mjs|cjs)$/.test(frame.source)
      if (looksLikeBundle) {
        this.logger.debug(`Skipping unresolved bundle frame: ${frame.source}`)
        continue
      }

      // Normalise: strip leading "/" so we can join with sourceRoot
      const relPath = frame.source.replace(/^\/+/, '')
      if (seen.has(relPath)) continue
      seen.add(relPath)

      // Strategy 1: exact path join
      let absPath = path.join(resolvedRoot, relPath)

      // Strategy 2: fuzzy basename search across sourceRoot
      if (!fs.existsSync(absPath)) {
        const basename = path.basename(frame.source)
        const found = this.findFileByName(resolvedRoot, basename)
        if (found) {
          this.logger.debug(`Fuzzy match for ${frame.source} → ${found}`)
          absPath = found
        } else {
          this.logger.warn(`Source file not found (exact + fuzzy): ${frame.source} under ${resolvedRoot}`)
          snippets.push({
            filePath: frame.source,
            errorLine: frame.line,
            code: `// File not found: ${frame.source}`,
            found: false,
          })
          continue
        }
      }

      try {
        const lines = fs.readFileSync(absPath, 'utf-8').split('\n')
        const start = Math.max(0, frame.line - contextLines - 1)
        const end = Math.min(lines.length, frame.line + contextLines)
        const excerpt = lines
          .slice(start, end)
          .map((l, i) => {
            const lineNo = start + i + 1
            const marker = lineNo === frame.line ? '>>>' : '   '
            return `${marker} ${String(lineNo).padStart(4, ' ')} | ${l}`
          })
          .join('\n')

        snippets.push({
          filePath: frame.source,
          errorLine: frame.line,
          code: `// ${frame.source}  (error at line ${frame.line})\n${excerpt}`,
          found: true,
        })

        this.logger.debug(`Extracted snippet from ${frame.source}:${frame.line} (${end - start} lines)`)
      } catch (err) {
        this.logger.error(`Failed to read ${absPath}`, err)
        snippets.push({
          filePath: frame.source,
          errorLine: frame.line,
          code: `// Failed to read ${frame.source}`,
          found: false,
        })
      }
    }

    return snippets
  }
}
