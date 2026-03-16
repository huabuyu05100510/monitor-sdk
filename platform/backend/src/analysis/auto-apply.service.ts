import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as fs from 'fs'
import * as path from 'path'
import { execFileSync } from 'child_process'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { ResolvedFrame } from '../sourcemaps/sourcemaps.service'

export interface ApplyResult {
  branch: string
  prUrl: string | null
  files: string[]
  commitHash: string
}

/** 项目级仓库凭证，回退到全局 .env */
export interface RepoCreds {
  token: string
  repo: string  // "owner/repo" format
}

interface Patch {
  filePath: string   // e.g. "src/pages/ErrorLab.tsx"
  searchCode: string // exact substring to find and replace
  replaceCode: string
}

@Injectable()
export class AutoApplyService {
  private readonly logger = new Logger(AutoApplyService.name)
  private readonly githubToken: string | null
  private readonly githubRepo: string | null   // "owner/repo"

  constructor(private readonly config: ConfigService) {
    this.githubToken = config.get<string>('GITHUB_TOKEN', '') || null
    this.githubRepo  = config.get<string>('GITHUB_REPO', '')  || null
  }

  // ── Step 1: Use LLM to extract structured patches from suggestedFix ───────

  async extractPatches(
    suggestedFix: string,
    resolvedStack: ResolvedFrame[],
    sourceRoot: string,
    llm: ChatOpenAI,
  ): Promise<Patch[]> {
    const root = path.resolve(sourceRoot)

    // Collect content of files referenced in the stack
    const fileContents: Record<string, string> = {}
    for (const frame of resolvedStack) {
      if (!frame.source || !frame.resolved) continue
      const relPath = frame.source.replace(/^\/+/, '')
      const absPath = path.join(root, relPath)
      if (!fileContents[relPath] && fs.existsSync(absPath)) {
        try { fileContents[relPath] = fs.readFileSync(absPath, 'utf-8') } catch { /* ignore */ }
      }
    }
    if (Object.keys(fileContents).length === 0) return []

    const filesSection = Object.entries(fileContents)
      .map(([p, c]) => `=== FILE: ${p} ===\n${c}`)
      .join('\n\n')

    const prompt = `
你是一个代码补丁生成器。根据以下源文件和 AI 修复建议，输出需要修改的代码补丁。

## 源文件
${filesSection}

## AI 修复建议
${suggestedFix}

## 输出格式
只输出一个 JSON 数组（不要任何 markdown 包装、不要解释文字）：
[
  {
    "filePath": "src/pages/ErrorLab.tsx",
    "searchCode": "从源文件中复制过来的、需要被替换的精确代码片段",
    "replaceCode": "替换后的新代码"
  }
]

规则：
- searchCode 必须是源文件中的精确子串（原文复制，不能有任何改动）
- 尽量只改动最少的代码
- 如果不确定改哪个文件，取堆栈里第一个有效源文件
- 每个文件只包含一个补丁条目
`.trim()

    try {
      const response = await llm.invoke([
        new SystemMessage('You are a precise code patch extractor. Output only a valid JSON array, absolutely no markdown.'),
        new HumanMessage(prompt),
      ])
      const raw = ((response as any).content as string).trim()
      // Strip possible markdown fences
      const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      const patches = JSON.parse(jsonStr) as Patch[]
      return Array.isArray(patches) ? patches.filter(p => p.filePath && p.searchCode !== undefined) : []
    } catch (err) {
      this.logger.error('Failed to extract patches', err)
      return []
    }
  }

  /** 解析 repoUrl（https://github.com/owner/repo）为 "owner/repo" */
  static parseOwnerRepo(repoUrl: string): string | null {
    try {
      const u = new URL(repoUrl.trim())
      const parts = u.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/')
      if (parts.length >= 2) return `${parts[0]}/${parts[1]}`
    } catch { /* ignore */ }
    return null
  }

  /** 合并项目级与全局凭证，项目级优先 */
  private resolveCreds(projectCreds?: Partial<RepoCreds>): RepoCreds | null {
    const token = projectCreds?.token || this.githubToken
    const repo   = projectCreds?.repo  || this.githubRepo
    if (token && repo) return { token, repo }
    return null
  }

  // ── Step 2: Apply patches + create branch + commit + push + PR ──────────

  async applyAndSubmit(
    errorEventId: string,
    patches: Patch[],
    sourceRoot: string,
    diagnosis: string,
    projectCreds?: Partial<RepoCreds>,
    resolvedStack?: ResolvedFrame[],
  ): Promise<ApplyResult> {
    const root = path.resolve(sourceRoot)
    const repoRoot = this.findRepoRoot(root)
    const branch = `fix/monitor-${errorEventId.slice(0, 8)}`

    // ── Guard: only allow patching code that covers a frame in the resolved stack ─
    //
    // Two-level check:
    //   1. File-level: patch.filePath must appear in resolvedStack
    //   2. Line-level: patch.searchCode must contain at least one line that the
    //      stack frames point to in that file (within ±TOLERANCE lines)
    //
    // This stops the LLM from silently fixing adjacent functions it happened
    // to see in the same context window (e.g. same file, different function).
    const LINE_TOLERANCE = 8   // allow a few lines of slop for LLM formatting differences

    let allowedPatches = patches
    if (resolvedStack && resolvedStack.length > 0) {
      // Build map: normalised filePath → error line numbers
      const fileFrames = new Map<string, number[]>()
      for (const f of resolvedStack) {
        if (!f.resolved || !f.source || f.line == null) continue
        const norm = f.source.replace(/^\/+/, '')
        if (!fileFrames.has(norm)) fileFrames.set(norm, [])
        fileFrames.get(norm)!.push(f.line)
      }

      allowedPatches = patches.filter((p) => {
        const norm = p.filePath.replace(/^\/+/, '')

        // Level 1: file must be in the stack
        if (!fileFrames.has(norm)) {
          this.logger.warn(`Patch guard [file]: rejected "${p.filePath}" — not in resolvedStack`)
          return false
        }

        // Level 2: verify searchCode touches an error line by reading the actual file
        const errorLines = fileFrames.get(norm)!
        const absPath = path.join(root, norm)
        if (fs.existsSync(absPath)) {
          try {
            const fileLines = fs.readFileSync(absPath, 'utf-8').split('\n')
            // Find where searchCode starts in the file
            const fileText = fileLines.join('\n')
            const offset = fileText.indexOf(p.searchCode)
            if (offset >= 0) {
              const patchStartLine = fileText.slice(0, offset).split('\n').length
              const patchEndLine   = patchStartLine + p.searchCode.split('\n').length - 1
              const overlaps = errorLines.some(
                (errLine) => errLine >= patchStartLine - LINE_TOLERANCE &&
                             errLine <= patchEndLine   + LINE_TOLERANCE,
              )
              if (!overlaps) {
                this.logger.warn(
                  `Patch guard [line]: rejected "${p.filePath}" lines ${patchStartLine}-${patchEndLine} ` +
                  `— error lines are [${errorLines.join(', ')}], no overlap within ±${LINE_TOLERANCE}`,
                )
                return false
              }
            }
          } catch { /* if we can't read the file, fall through and allow */ }
        }

        return true
      })

      if (allowedPatches.length < patches.length) {
        this.logger.log(
          `Patch guard: ${patches.length - allowedPatches.length} patch(es) rejected, ` +
          `${allowedPatches.length} accepted`,
        )
      }
    }

    // ── Apply patches to disk ──────────────────────────────────────────────
    const appliedFiles: string[] = []
    for (const patch of allowedPatches) {
      const relPath = patch.filePath.replace(/^\/+/, '')
      const absPath = path.join(root, relPath)

      if (!fs.existsSync(absPath)) {
        this.logger.warn(`Patch target not found: ${absPath}`)
        continue
      }
      const original = fs.readFileSync(absPath, 'utf-8')
      if (!original.includes(patch.searchCode)) {
        this.logger.warn(`searchCode not found in ${patch.filePath} — skipping`)
        continue
      }
      // Apply first occurrence only
      const patched = original.replace(patch.searchCode, patch.replaceCode)
      fs.writeFileSync(absPath, patched, 'utf-8')
      appliedFiles.push(absPath)
      this.logger.log(`Patched ${patch.filePath}`)
    }

    if (appliedFiles.length === 0) {
      throw new Error('No patches could be applied (searchCode not found in source files)')
    }

    // ── Git: save current branch, create fix branch ───────────────────────
    // Use execFileSync (args array) to avoid shell interpretation of backticks, newlines, etc.
    const git = (...args: string[]) =>
      execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf-8', timeout: 30_000 }).trim()

    const originalBranch = git('rev-parse', '--abbrev-ref', 'HEAD')

    // Delete stale local branch if it exists
    try { git('branch', '-D', branch) } catch { /* not exists, fine */ }

    git('checkout', '-b', branch)

    try {
      // Stage only the patched files
      const relPaths = appliedFiles.map(abs => path.relative(repoRoot, abs))
      git('add', ...relPaths)

      const shortDiagnosis = diagnosis.replace(/\n/g, ' ').slice(0, 72)
      const commitMsg = [
        `fix: ${shortDiagnosis}`,
        '',
        `Auto-generated by Monitor Platform AI root-cause analysis`,
        `Error event: ${errorEventId}`,
      ].join('\n')

      const commitOut = git('commit', '-m', commitMsg)
      const commitHash = /\[.+?([a-f0-9]{7,})\]/.exec(commitOut)?.[1] ?? 'unknown'

      // Push
      git('push', '--force-with-lease', 'origin', branch)

      // Create PR — prefer project-level creds, fall back to global .env
      let prUrl: string | null = null
      const creds = this.resolveCreds(projectCreds)
      if (creds) {
        prUrl = await this.createPR(branch, shortDiagnosis, errorEventId, diagnosis, creds)
      }

      return { branch, prUrl, files: appliedFiles.map(abs => path.relative(root, abs)), commitHash }
    } finally {
      // Always return to original branch
      try { git('checkout', originalBranch) } catch { /* ignore */ }
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private findRepoRoot(startDir: string): string {
    let dir = startDir
    for (let i = 0; i < 12; i++) {
      if (fs.existsSync(path.join(dir, '.git'))) return dir
      const parent = path.dirname(dir)
      if (parent === dir) break
      dir = parent
    }
    return startDir
  }

  private async createPR(
    branch: string,
    title: string,
    errorEventId: string,
    diagnosis: string,
    creds: RepoCreds,
  ): Promise<string | null> {
    const [owner, repo] = creds.repo.split('/')
    if (!owner || !repo) return null

    const body = [
      '## AI 根因分析自动修复',
      '',
      `**错误事件 ID：** \`${errorEventId}\``,
      '',
      '### 根因诊断',
      diagnosis,
      '',
      '---',
      '*由 Monitor Platform AI 根因分析自动生成，请 review 后合并。*',
    ].join('\n')

    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
        method: 'POST',
        headers: {
          Authorization: `token ${creds.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github+json',
        },
        body: JSON.stringify({ title: `fix: ${title}`, body, head: branch, base: 'master' }),
      })

      if (!res.ok) {
        const body = await res.text()
        // PR already exists for this branch — fetch and return the existing PR URL
        if (res.status === 422 && body.includes('pull request already exists')) {
          return await this.findExistingPR(owner, repo, branch, creds.token)
        }
        this.logger.error(`GitHub PR failed: ${res.status} ${body}`)
        return null
      }
      const data = await res.json() as { html_url: string }
      this.logger.log(`PR created: ${data.html_url}`)
      return data.html_url
    } catch (err) {
      this.logger.error('Failed to create PR', err)
      return null
    }
  }

  private async findExistingPR(owner: string, repo: string, branch: string, token: string): Promise<string | null> {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls?head=${owner}:${branch}&state=open`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github+json',
          },
        },
      )
      if (!res.ok) return null
      const prs = await res.json() as Array<{ html_url: string }>
      if (prs.length > 0) {
        this.logger.log(`Existing PR found: ${prs[0].html_url}`)
        return prs[0].html_url
      }
    } catch { /* ignore */ }
    return null
  }
}
