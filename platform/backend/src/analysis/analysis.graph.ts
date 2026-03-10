import { StateGraph, END } from '@langchain/langgraph'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { AnalysisAnnotation, AnalysisState } from './analysis.state'
import { SourcemapsService } from '../sourcemaps/sourcemaps.service'
import { CodeRagService } from './code-rag.service'
import { CodeReaderService } from './code-reader.service'

function buildAnalystPrompt(state: AnalysisState): string {
  const stackText = state.resolvedStack
    .filter((f) => f.source)
    .map((f) => `  ${f.source}:${f.line}:${f.column}  ${f.name ?? ''}`)
    .join('\n')

  const codeText =
    state.relatedCode.length > 0
      ? state.relatedCode.join('\n\n---\n\n')
      : '（未检索到相关源码，请仅根据堆栈信息进行分析）'

  const errorDesc = JSON.stringify(state.rawError, null, 2)

  return `
## 错误信息
\`\`\`json
${errorDesc}
\`\`\`

## 还原后的调用堆栈
\`\`\`
${stackText || '（未能还原堆栈）'}
\`\`\`

## 相关源码片段（RAG 检索结果）
\`\`\`typescript
${codeText}
\`\`\`
  `.trim()
}

function buildReviewPrompt(diagnosis: string, fix: string): string {
  return `
请检查以下根因分析和修复建议是否合理，用 1-2 句话作出判断：

===DIAGNOSIS===
${diagnosis}

===FIX===
${fix}

评估要点：分析是否准确？修复是否可行且符合最佳实践？
  `.trim()
}

export function buildAnalysisGraph(
  sourcemapsService: SourcemapsService,
  codeRagService: CodeRagService,
  codeReaderService: CodeReaderService,
  llm: ChatOpenAI,
) {
  // ── Node: Resolve ─────────────────────────────────────────────────────────
  async function resolveNode(state: AnalysisState): Promise<Partial<AnalysisState>> {
    const stack = (state.rawError.stack as string) ?? ''
    if (!stack) {
      return { warnings: ['No stack trace available, skipping source map resolution'] }
    }

    try {
      const resolved = await sourcemapsService.resolveStack(state.appId, state.version, stack)
      // Drop frames that resolved to node_modules (e.g. react-dom internals) — not actionable
      const useful = resolved.filter(
        (f) => !f.source?.includes('node_modules') && !f.source?.includes('/node_modules/'),
      )
      return { resolvedStack: useful.length > 0 ? useful : resolved }
    } catch (err) {
      return {
        warnings: [`Source map resolution failed: ${(err as Error).message}`],
        resolvedStack: [],
      }
    }
  }

  // ── Node: Retrieve ────────────────────────────────────────────────────────
  async function retrieveNode(state: AnalysisState): Promise<Partial<AnalysisState>> {
    // Strategy 1 (preferred): direct file read when sourceRoot is configured.
    // This is more precise than embedding search — we already know the exact file + line.
    if (state.sourceRoot) {
      const snippets = codeReaderService.extractSnippets(state.resolvedStack, state.sourceRoot)
      if (snippets.length > 0) {
        const relatedCode = snippets.map((s) => s.code)
        return { relatedCode }
      }
    }

    // Strategy 2 (fallback): ChromaDB RAG — useful when sourceRoot not set
    const message = (state.rawError.message as string) ?? ''
    const files = state.resolvedStack
      .filter((f) => f.source)
      .slice(0, 3)
      .map((f) => f.source!)
      .join(' ')
    const query = `${message} ${files}`.trim()
    const relatedCode = query ? await codeRagService.retrieve(query, state.appId) : []

    return { relatedCode }
  }

  // ── Node: Analyst ─────────────────────────────────────────────────────────
  async function analystNode(state: AnalysisState): Promise<Partial<AnalysisState>> {
    const userPrompt = buildAnalystPrompt(state)

    const response = await llm.invoke([
      new SystemMessage(
        '你是一名资深前端工程师，擅长根因分析和 TypeScript / React 代码审查。\n' +
          '请仔细阅读下方错误信息、堆栈和源码，找出逻辑漏洞或异常原因，并给出具体的修复代码补丁。\n\n' +
          '**必须严格按以下格式输出，不得改变分隔符：**\n\n' +
          '===DIAGNOSIS===\n' +
          '（在此写 2-4 句根因分析）\n\n' +
          '===FIX===\n' +
          '（在此写具体修复代码，使用代码块）',
      ),
      new HumanMessage(userPrompt),
    ])

    const content = (response as any).content as string

    // Parse using explicit section delimiters — robust to any LLM markdown style
    const diagnosisMatch = /===DIAGNOSIS===\s*([\s\S]*?)(?====FIX===|$)/i.exec(content)
    const fixMatch = /===FIX===\s*([\s\S]*)/i.exec(content)

    // Graceful fallback: if LLM ignored the delimiters, split on common heading patterns
    const fallbackDiagnosis = () => {
      const m = /(?:\*\*根因分析\*\*|#{1,3}\s*根因分析)[:：]?\s*([\s\S]*?)(?=\n(?:#{1,3}\s*\S|\*\*[^*]+\*\*)|\s*$)/i.exec(content)
      return m?.[1]?.trim() ?? content
    }
    const fallbackFix = () => {
      const m = /(?:\*\*修复建议\*\*|#{1,3}\s*修复建议)[:：]?\s*([\s\S]*)/i.exec(content)
      return m?.[1]?.trim() ?? ''
    }

    return {
      diagnosis: diagnosisMatch?.[1]?.trim() || fallbackDiagnosis(),
      suggestedFix: fixMatch?.[1]?.trim() || fallbackFix(),
    }
  }

  // ── Node: Review ──────────────────────────────────────────────────────────
  async function reviewNode(state: AnalysisState): Promise<Partial<AnalysisState>> {
    if (!state.diagnosis) {
      return { reviewNote: 'No diagnosis to review' }
    }

    const response = await llm.invoke([
      new SystemMessage('你是一名 TypeScript 代码审查专家，请简短评估以下分析结论的准确性与建议的合理性。'),
      new HumanMessage(buildReviewPrompt(state.diagnosis, state.suggestedFix)),
    ])

    return { reviewNote: ((response as any).content as string).trim() }
  }

  // ── Graph definition ──────────────────────────────────────────────────────
  const graph = new StateGraph(AnalysisAnnotation)
    .addNode('resolve', resolveNode)
    .addNode('retrieve', retrieveNode)
    .addNode('analyst', analystNode)
    .addNode('review', reviewNode)
    .addEdge('__start__', 'resolve')
    .addEdge('resolve', 'retrieve')
    .addEdge('retrieve', 'analyst')
    .addEdge('analyst', 'review')
    .addEdge('review', END)

  return graph.compile()
}
