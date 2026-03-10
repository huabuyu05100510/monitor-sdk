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
   * Given a list of resolved stack frames and a project source root,
   * extract ±contextLines of source code around each frame.
   *
   * A frame is eligible if:
   *  - `resolved` is true
   *  - `source` looks like a project file (starts with "/src/" or similar)
   *  - the file actually exists under `sourceRoot`
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

      // Normalise: strip leading "/" so we can join with sourceRoot
      // e.g. "/src/App.tsx" → "src/App.tsx"
      const relPath = frame.source.replace(/^\/+/, '')
      if (seen.has(relPath)) continue
      seen.add(relPath)

      const absPath = path.join(resolvedRoot, relPath)

      if (!fs.existsSync(absPath)) {
        this.logger.warn(`Source file not found: ${absPath}`)
        snippets.push({
          filePath: frame.source,
          errorLine: frame.line,
          code: `// File not found: ${absPath}`,
          found: false,
        })
        continue
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
