import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ChatOpenAI } from '@langchain/openai'
import { buildAnalysisGraph } from './analysis.graph'
import { CodeRagService } from './code-rag.service'
import { CodeReaderService } from './code-reader.service'
import { SourcemapsService } from '../sourcemaps/sourcemaps.service'
import { ErrorsService } from '../errors/errors.service'
import { ProjectsService } from '../projects/projects.service'

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name)
  private readonly graph: ReturnType<typeof buildAnalysisGraph> | null = null

  constructor(
    private readonly config: ConfigService,
    private readonly sourcemapsService: SourcemapsService,
    private readonly codeRagService: CodeRagService,
    private readonly codeReaderService: CodeReaderService,
    private readonly errorsService: ErrorsService,
    private readonly projectsService: ProjectsService,
  ) {
    const apiKey = this.config.get('OPENAI_API_KEY', '')
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not set — AI analysis is disabled. Set it in .env to enable.')
      return
    }
    const baseURL = this.config.get('OPENAI_BASE_URL', 'https://api.openai.com/v1')
    const isOpenRouter = baseURL.includes('openrouter.ai')

    const llm = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: this.config.get('OPENAI_MODEL', 'gpt-4o'),
      temperature: 0.2,
      configuration: {
        baseURL,
        // OpenRouter requires these headers to identify the app
        defaultHeaders: isOpenRouter
          ? {
              'HTTP-Referer': 'https://monitor-platform.local',
              'X-Title': 'Monitor Platform',
            }
          : {},
      },
    })
    this.logger.log(`LLM ready: ${this.config.get('OPENAI_MODEL')} via ${baseURL}`)
    this.graph = buildAnalysisGraph(this.sourcemapsService, this.codeRagService, this.codeReaderService, llm)
  }

  /**
   * Run the full LangGraph analysis pipeline for a given error event.
   * Updates the ErrorEvent record with the analysis result when done.
   */
  async analyze(errorEventId: string, version?: string): Promise<Record<string, unknown>> {
    if (!this.graph) {
      throw new ServiceUnavailableException(
        'AI analysis is disabled: OPENAI_API_KEY not configured in platform/backend/.env',
      )
    }
    const event = await this.errorsService.findOne(errorEventId)
    if (!event) throw new NotFoundException(`ErrorEvent ${errorEventId} not found`)

    // Resolve version: param > project.sourcemapVersion > 'latest'
    const project = await this.projectsService.findByAppId(event.appId)
    const resolvedVersion = version ?? project?.sourcemapVersion ?? 'latest'

    const sourceRoot = project?.sourceRoot ?? null

    this.logger.log(
      `Analyzing ${errorEventId} — appId=${event.appId} version=${resolvedVersion}` +
        (sourceRoot ? ` sourceRoot=${sourceRoot}` : ' (no sourceRoot configured)'),
    )

    // Mark as analyzing
    await this.errorsService.updateAnalysis(errorEventId, 'analyzing', null)

    const initialState = {
      errorEventId,
      projectId: event.appId,
      appId: event.appId,
      version: resolvedVersion,
      sourceRoot,
      rawError: event.payload,
    }

    try {
      const result = await this.graph.invoke(initialState)

      const analysis = {
        resolvedStack: result.resolvedStack,
        relatedCode: result.relatedCode,
        diagnosis: result.diagnosis,
        suggestedFix: result.suggestedFix,
        reviewNote: result.reviewNote,
        warnings: result.warnings,
        analyzedAt: new Date().toISOString(),
      }

      await this.errorsService.updateAnalysis(errorEventId, 'analyzed', analysis)
      return analysis
    } catch (err) {
      this.logger.error(`Analysis failed for event ${errorEventId}`, err)
      const analysis = {
        error: (err as Error).message,
        analyzedAt: new Date().toISOString(),
      }
      await this.errorsService.updateAnalysis(errorEventId, 'new', analysis)
      throw err
    }
  }

  /**
   * Index a code snippet into the vector store.
   * Called after each build/deploy to keep the RAG index up to date.
   */
  indexCode(doc: Parameters<CodeRagService['indexDocument']>[0]) {
    return this.codeRagService.indexDocument(doc)
  }

  /**
   * Walk the project's sourceRoot and batch-index all source files into ChromaDB.
   * Returns stats on how many chunks were indexed.
   */
  async indexSource(appId: string): Promise<
    { files: number; indexed: number; skipped: number } | { error: string }
  > {
    const project = await this.projectsService.findByAppId(appId)
    if (!project) return { error: `Project not found: ${appId}` }
    if (!project.sourceRoot) {
      return { error: '请先在项目设置中配置 sourceRoot（源码根目录）' }
    }

    this.logger.log(`Indexing source for ${appId} from ${project.sourceRoot}`)
    return this.codeRagService.walkAndIndex(project.sourceRoot, appId, project.id)
  }
}
