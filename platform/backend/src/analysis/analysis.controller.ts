import { Controller, Post, Body, Param, Query, BadRequestException } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { AnalysisService } from './analysis.service'

@ApiTags('analysis')
@Controller('analysis')
export class AnalysisController {
  constructor(private readonly svc: AnalysisService) {}

  /**
   * Trigger AI root-cause analysis for a specific error event.
   * Pass the build `version` to correctly match source maps.
   */
  @Post('analyze/:errorEventId')
  @ApiOperation({ summary: '触发 AI 根因分析（LangGraph 流水线）。version 留空则自动读取项目设置中的 sourcemapVersion' })
  analyze(
    @Param('errorEventId') errorEventId: string,
    @Query('version') version?: string,
  ) {
    return this.svc.analyze(errorEventId, version)
  }

  /**
   * Apply the AI-suggested fix to source code, create a git branch, and open a PR.
   * Requires: analysis already run, sourceRoot configured, GITHUB_TOKEN + GITHUB_REPO in .env.
   */
  @Post('apply/:errorEventId')
  @ApiOperation({ summary: '将 AI 修复建议应用到源码，自动建分支并向 master 提 PR' })
  apply(@Param('errorEventId') errorEventId: string) {
    return this.svc.applyFix(errorEventId)
  }

  /**
   * Walk the project's sourceRoot and batch-index all source files into ChromaDB.
   * The sourceRoot must be configured on the project settings first.
   */
  @Post('index-source/:appId')
  @ApiOperation({ summary: '扫描项目 sourceRoot 目录，将所有源码文件批量索引到 RAG 向量库' })
  async indexSource(@Param('appId') appId: string) {
    const result = await this.svc.indexSource(appId)
    if ('error' in result) throw new BadRequestException(result.error)
    return result
  }

  /**
   * Index a single code snippet into the RAG vector store (CI/CD pipeline use).
   */
  @Post('index-code')
  @ApiOperation({ summary: '将单个代码片段写入 RAG 向量数据库' })
  indexCode(
    @Body()
    body: {
      appId: string
      projectId: string
      filePath: string
      functionName: string
      startLine: number
      endLine: number
      code: string
    },
  ) {
    return this.svc.indexCode(body)
  }
}
