import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { OpenAIEmbeddings } from '@langchain/openai'
import { ChromaClient, Collection } from 'chromadb'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Manages the code vector store (ChromaDB) and provides:
 *  - indexDocument(): add a code snippet to the vector store
 *  - retrieve():      similarity search for related code snippets
 */
@Injectable()
export class CodeRagService implements OnModuleInit {
  private readonly logger = new Logger(CodeRagService.name)
  private collection: Collection | null = null
  private embeddings: OpenAIEmbeddings | null = null
  private chromaClient: ChromaClient

  constructor(private readonly config: ConfigService) {
    const apiKey = config.get('OPENAI_API_KEY', '')
    if (apiKey) {
      const baseURL = config.get('OPENAI_BASE_URL', 'https://api.openai.com/v1')
      const isOpenRouter = baseURL.includes('openrouter.ai')
      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: apiKey,
        modelName: isOpenRouter ? 'openai/text-embedding-3-small' : undefined,
        configuration: {
          baseURL,
          defaultHeaders: isOpenRouter
            ? { 'HTTP-Referer': 'https://monitor-platform.local', 'X-Title': 'Monitor Platform' }
            : {},
        },
      })
    }

    this.chromaClient = new ChromaClient({
      path: config.get('CHROMA_URL', 'http://localhost:8000'),
    })
  }

  async onModuleInit() {
    if (!this.embeddings) {
      this.logger.warn('OPENAI_API_KEY not set — code RAG is disabled')
      return
    }
    try {
      this.collection = await this.chromaClient.getOrCreateCollection({
        name: 'monitor_code_index',
        metadata: { 'hnsw:space': 'cosine' },
      })
      this.logger.log('ChromaDB collection ready')
    } catch {
      this.logger.warn(
        'ChromaDB not available — code RAG will return empty results. ' +
          'Start ChromaDB to enable: docker run -p 8000:8000 chromadb/chroma',
      )
    }
  }

  /**
   * Index a code snippet (function / component) into the vector store.
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
    if (!this.collection || !this.embeddings) return

    const id = `${doc.appId}__${doc.filePath}__${doc.functionName}__${doc.startLine}`
    const embedding = await this.embeddings.embedQuery(doc.code)

    await this.collection.upsert({
      ids: [id],
      embeddings: [embedding],
      documents: [doc.code],
      metadatas: [
        {
          appId: doc.appId,
          projectId: doc.projectId,
          filePath: doc.filePath,
          functionName: doc.functionName,
          startLine: doc.startLine,
          endLine: doc.endLine,
        },
      ],
    })
  }

  /**
   * Walk a source directory and index all .ts/.tsx/.js/.jsx files into the vector store.
   * Each file is split into chunks of up to `chunkLines` lines to keep embeddings focused.
   * Returns the number of chunks indexed.
   */
  async walkAndIndex(
    sourceRoot: string,
    appId: string,
    projectId: string,
    chunkLines = 60,
  ): Promise<{ indexed: number; skipped: number; files: number }> {
    if (!this.collection || !this.embeddings) {
      this.logger.warn('walkAndIndex called but ChromaDB / embeddings not available')
      return { indexed: 0, skipped: 0, files: 0 }
    }

    const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.cache', 'coverage', 'build', '__tests__'])
    const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx'])

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

    for (const filePath of allFiles) {
      let content: string
      try { content = fs.readFileSync(filePath, 'utf-8') } catch { skipped++; continue }

      const lines = content.split('\n')
      const relPath = '/' + path.relative(path.resolve(sourceRoot), filePath).replace(/\\/g, '/')

      // Split file into overlapping chunks
      for (let start = 0; start < lines.length; start += chunkLines - 10) {
        const end = Math.min(lines.length, start + chunkLines)
        const chunkCode = lines.slice(start, end).join('\n').trim()
        if (chunkCode.length < 30) continue  // skip tiny chunks

        // Extract a representative function name from the chunk (first function/const/class)
        const fnMatch = /(?:function\s+(\w+)|(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s+)?(?:const|let|var)\s+(\w+)\s*[=:]\s*(?:async\s+)?\(|class\s+(\w+))/.exec(chunkCode)
        const functionName = fnMatch?.[1] ?? fnMatch?.[2] ?? fnMatch?.[3] ?? `chunk_${start}`

        try {
          await this.indexDocument({
            appId,
            projectId,
            filePath: relPath,
            functionName,
            startLine: start + 1,
            endLine: end,
            code: chunkCode,
          })
          indexed++
        } catch (err) {
          this.logger.warn(`Failed to index ${relPath}:${start}`, err)
          skipped++
        }
      }
    }

    this.logger.log(`walkAndIndex done: ${allFiles.length} files, ${indexed} chunks indexed, ${skipped} skipped`)
    return { indexed, skipped, files: allFiles.length }
  }

  /**
   * Retrieve the top-k most relevant code snippets.
   * Always filter by appId for multi-tenant isolation.
   */
  async retrieve(query: string, appId: string, k = 5): Promise<string[]> {
    if (!this.collection || !this.embeddings) return []

    try {
      const queryEmbedding = await this.embeddings.embedQuery(query)

      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: k,
        where: { appId },
        include: ['documents', 'metadatas'] as any,
      })

      const docs = results.documents?.[0] ?? []
      const metas = results.metadatas?.[0] ?? []

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
