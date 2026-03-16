import { Module } from '@nestjs/common'
import { AnalysisService } from './analysis.service'
import { AnalysisController } from './analysis.controller'
import { CodeRagService } from './code-rag.service'
import { CodeReaderService } from './code-reader.service'
import { AutoApplyService } from './auto-apply.service'
import { SourcemapsModule } from '../sourcemaps/sourcemaps.module'
import { ErrorsModule } from '../errors/errors.module'
import { ProjectsModule } from '../projects/projects.module'

@Module({
  imports: [SourcemapsModule, ErrorsModule, ProjectsModule],
  providers: [AnalysisService, CodeRagService, CodeReaderService, AutoApplyService],
  controllers: [AnalysisController],
})
export class AnalysisModule {}
