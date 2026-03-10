import { Controller, Post, Body, Param, Query } from '@nestjs/common'
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
    @Query('version') version?: string,   // undefined = use project.sourcemapVersion
  ) {
    return this.svc.analyze(errorEventId, version)
  }

  /**
   * Index a code snippet into the RAG vector store.
   * Typically called by your CI/CD pipeline after each build.
   */
  @Post('index-code')
  @ApiOperation({ summary: '将代码片段写入 RAG 向量数据库' })
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
