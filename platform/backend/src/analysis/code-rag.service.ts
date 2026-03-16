import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ChromaClient, Collection } from 'chromadb'
import * as fs from 'fs'
import * as path from 'path'

// ── Local embedding (zero external API) ────────────────────────────────────
//
// Approach: hash-based bag-of-words projection.
//   1. Tokenize code into identifiers / keywords / operators
//   2. For each token, deterministically hash it to a bucket in [0, DIM)
//   3. Accumulate TF counts → normalize to unit vector
//
// Quality: equivalent to a unigram language model over code tokens.
// For code retrieval (where function/variable names dominate), this
// captures the right signals without any network calls or model files.

const EMBED_DIM = 512

/** djb2 hash → index in [0, EMBED_DIM) */
function tokenHash(token: string): number {
  let h = 5381
  for (let i = 0; i < token.length; i++) {
    h = ((h << 5) + h) ^ token.charCodeAt(i)
    h = h >>> 0  // keep unsigned 32-bit
  }
  return h % EMBED_DIM
}

/** Extract meaningful tokens from source code */
function tokenize(code: string): string[] {
  // identifiers, keywords, string literals (first 16 chars), numbers
  return Array.from(
    code.matchAll(/[a-zA-Z_$][a-zA-Z0-9_$]*/g),
    (m) => m[0],
  ).filter((t) => t.length >= 2)  // skip single-char tokens
}

/** Produce a normalized float32 embedding vector for a code string */
function embedCode(code: string): number[] {
  const vec = new Float64Array(EMBED_DIM)
  const tokens = tokenize(code)
  if (tokens.length === 0) return Array.from({ length: EMBED_DIM }, () => 0)

  // TF weighting: count occurrences
  for (const t of tokens) {
    vec[tokenHash(t)] += 1
  }

  // L2 normalize
  let norm = 0
  for (let i = 0; i < EMBED_DIM; i++) norm += vec[i] * vec[i]
  norm = Math.sqrt(norm) || 1
  return Array.from(vec, (v) => v / norm)
}

// ── AST-based function-level code slicer ───────────────────────────────────
//
// JS files  → esprima  (accurate, handles all function forms)
// TS / TSX  → regex    (handles function decls, arrow fns, class methods)

interface CodeSlice {
  name: string
  startLine: number
  endLine: number
  code: string
}

function sliceJS(source: string, filePath: string): CodeSlice[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const esprima = require('esprima')
    const ast = esprima.parseScript(source, { loc: true, tolerant: true })
    const slices: CodeSlice[] = []
    const lines = source.split('\n')

    function visit(node: any) {
      if (!node || typeof node !== 'object') return
      const isFn =
        node.type === 'FunctionDeclaration' ||
        node.type === 'FunctionExpression' ||
        node.type === 'ArrowFunctionExpression' ||
        node.type === 'MethodDefinition'

      if (isFn && node.loc) {
        const start = node.loc.start.line - 1
        const end   = node.loc.end.line
        const name  = node.id?.name ?? node.key?.name ?? `fn_${start + 1}`
        slices.push({ name, startLine: start + 1, endLine: end, code: lines.slice(start, end).join('\n') })
      }
      for (const key of Object.keys(node)) {
        const child = node[key]
        if (Array.isArray(child)) child.forEach(visit)
        else if (child && typeof child === 'object' && child.type) visit(child)
      }
    }
    visit(ast)
    return slices
  } catch {
    return sliceByRegex(source, filePath)
  }
}

function sliceByRegex(source: string, _filePath: string): CodeSlice[] {
  const slices: CodeSlice[] = []
  const lines = source.split('\n')

  // Pattern: exported/async function declarations, const arrow functions, class methods
  const FN_START = /(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)\s*\(|(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(|^\s{0,4}(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\S+\s*)?\{/

  let i = 0
  while (i < lines.length) {
    const match = FN_START.exec(lines[i])
    if (match) {
      const name = match[1] ?? match[2] ?? match[3] ?? `fn_${i + 1}`
      const startLine = i + 1

      // Find the closing brace by tracking depth
      let depth = 0
      let end = i
      for (let j = i; j < Math.min(i + 120, lines.length); j++) {
        depth += (lines[j].match(/\{/g) ?? []).length
        depth -= (lines[j].match(/\}/g) ?? []).length
        if (depth <= 0 && j > i) { end = j + 1; break }
        if (j === Math.min(i + 119, lines.length - 1)) end = j + 1
      }

      const code = lines.slice(i, end).join('\n').trim()
      if (code.length > 20) slices.push({ name, startLine, endLine: end, code })
      i = end
    } else {
      i++
    }
  }
  return slices
}

function sliceFile(source: string, filePath: string): CodeSlice[] {
  const ext = path.extname(filePath)
  const slices = ext === '.js' || ext === '.jsx'
    ? sliceJS(source, filePath)
    : sliceByRegex(source, filePath)

  // De-duplicate and remove tiny slices
  const seen = new Set<string>()
  return slices.filter((s) => {
    const key = `${s.startLine}`
    if (seen.has(key) || s.code.length < 30) return false
    seen.add(key)
    return true
  })
}

// ── Service ────────────────────────────────────────────────────────────────

/**
 * Manages the code vector store (ChromaDB) and provides:
 *  - indexDocument():  add a function-level code slice to the store
 *  - walkAndIndex():   scan a sourceRoot dir, slice all files, and index
 *  - retrieve():       similarity search for relevant code
 *
 * Embedding is purely local (hash-based bag-of-words, EMBED_DIM=512).
 * No external API calls required.
 */
@Injectable()
export class CodeRagService implements OnModuleInit {
  private readonly logger = new Logger(CodeRagService.name)
  private collection: Collection | null = null
  private chromaClient: ChromaClient

  constructor(private readonly config: ConfigService) {
    this.chromaClient = new ChromaClient({
      path: config.get('CHROMA_URL', 'http://localhost:8000'),
    })
  }

  async onModuleInit() {
    try {
      this.collection = await this.chromaClient.getOrCreateCollection({
        name: 'monitor_code_index',
        metadata: { 'hnsw:space': 'cosine' },
      })
      this.logger.log('ChromaDB collection ready (local embedding, no API needed)')
    } catch {
      this.logger.warn(
        'ChromaDB not available — code RAG will return empty results. ' +
        'Start ChromaDB: chroma run --host 0.0.0.0 --port 8000',
      )
    }
  }

  /**
   * Index a single code slice into the vector store.
   */
  async indexDocument(doc: {
    appId: string
    projectId: string
    filePath: string
    functionName: string
    startLine: number
    endLine: number
    code: string
  }): Promise<void> {
    if (!this.collection) return

    const id = `${doc.appId}__${doc.filePath}__${doc.functionName}__${doc.startLine}`
    const embedding = embedCode(doc.code)

    await this.collection.upsert({
      ids: [id],
      embeddings: [embedding],
      documents: [doc.code],
      metadatas: [{
        appId: doc.appId,
        projectId: doc.projectId,
        filePath: doc.filePath,
        functionName: doc.functionName,
        startLine: doc.startLine,
        endLine: doc.endLine,
      }],
    })
  }

  /**
   * Walk sourceRoot, slice every .ts/.tsx/.js/.jsx file at the function level,
   * and index each slice into ChromaDB.
   */
  async walkAndIndex(
    sourceRoot: string,
    appId: string,
    projectId: string,
  ): Promise<{ indexed: number; skipped: number; files: number }> {
    if (!this.collection) {
      this.logger.warn('walkAndIndex: ChromaDB not available')
      return { indexed: 0, skipped: 0, files: 0 }
    }

    const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.cache', 'coverage', 'build', '__tests__'])
    const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx'])

    // Collect all source files
    const allFiles: string[] = []
    const queue: string[] = [path.resolve(sourceRoot)]
    while (queue.length > 0) {
      const dir = queue.shift()!
      let entries: fs.Dirent[]
      try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { continue }
      for (const e of entries) {
        if (e.isDirectory()) {
          if (!SKIP_DIRS.has(e.name)) queue.push(path.join(dir, e.name))
        } else if (SOURCE_EXT.has(path.extname(e.name))) {
          allFiles.push(path.join(dir, e.name))
        }
      }
    }

    let indexed = 0
    let skipped = 0

    for (const absPath of allFiles) {
      let source: string
      try { source = fs.readFileSync(absPath, 'utf-8') } catch { skipped++; continue }

      const relPath = '/' + path.relative(path.resolve(sourceRoot), absPath).replace(/\\/g, '/')
      const slices = sliceFile(source, absPath)

      for (const slice of slices) {
        try {
          await this.indexDocument({
            appId, projectId,
            filePath: relPath,
            functionName: slice.name,
            startLine: slice.startLine,
            endLine: slice.endLine,
            code: slice.code,
          })
          indexed++
        } catch {
          skipped++
        }
      }
      if (slices.length === 0) skipped++
    }

    this.logger.log(
      `walkAndIndex: ${allFiles.length} files, ${indexed} function slices indexed, ${skipped} skipped`,
    )
    return { indexed, skipped, files: allFiles.length }
  }

  /**
   * Retrieve top-k most similar function slices for a query string.
   * Filtered by appId for multi-project isolation.
   */
  async retrieve(query: string, appId: string, k = 5): Promise<string[]> {
    if (!this.collection) return []

    try {
      const queryEmbedding = embedCode(query)

      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: k,
        where: { appId },
        include: ['documents', 'metadatas'] as any,
      })

      const docs  = results.documents?.[0] ?? []
      const metas = results.metadatas?.[0]  ?? []

      return docs.map((doc, i) => {
        const meta = metas[i] as any
        return `// ${meta?.filePath ?? ''} — ${meta?.functionName ?? ''} (line ${meta?.startLine ?? '?'})\n${doc}`
      })
    } catch (err) {
      this.logger.error('Vector store retrieval failed', err)
      return []
    }
  }
}
