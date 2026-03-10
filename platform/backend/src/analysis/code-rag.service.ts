import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { OpenAIEmbeddings } from '@langchain/openai'
import { ChromaClient, Collection } from 'chromadb'

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
