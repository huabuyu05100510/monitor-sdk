import {
  Controller, Post, Get, Param, Body,
  UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger'
import { execSync } from 'child_process'
import * as path from 'path'
import { SourcemapsService } from './sourcemaps.service'
import { ProjectsService } from '../projects/projects.service'

@ApiTags('sourcemaps')
@Controller('sourcemaps')
export class SourcemapsController {
  constructor(
    private readonly svc: SourcemapsService,
    private readonly projectsSvc: ProjectsService,
  ) {}

  /**
   * Upload a .map file.
   * Form fields: appId, version, filename, (optional) sourcemapDir
   * File field:  map
   */
  @Post('upload')
  @ApiOperation({ summary: '上传 Source Map 文件' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('map'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { appId: string; version: string; filename: string; sourcemapDir?: string },
  ) {
    if (!file) throw new BadRequestException('map file is required')
    const { appId, version, filename, sourcemapDir } = body
    if (!appId || !version || !filename) {
      throw new BadRequestException('appId, version and filename are required')
    }

    // If the project has a configured sourcemapDir, prefer that over the form param
    const project = await this.projectsSvc.findByAppId(appId)
    const effectiveDir = project?.sourcemapDir ?? sourcemapDir ?? null

    const saved = await this.svc.save(appId, version, filename, file.buffer, effectiveDir)

    // Auto-update project's sourcemapVersion to the just-uploaded version
    if (project && project.sourcemapVersion !== version) {
      await this.projectsSvc.update(project.id, { sourcemapVersion: version })
    }

    return { ...saved, effectiveDir: this.svc.resolveBaseDir(effectiveDir) }
  }

  @Get(':appId')
  @ApiOperation({ summary: '列出某项目的所有 Source Map' })
  list(@Param('appId') appId: string) {
    return this.svc.listByApp(appId)
  }

  /** Debug endpoint: resolve a raw stack string */
  @Post('resolve')
  @ApiOperation({ summary: '还原压缩堆栈（调试用）' })
  async resolve(@Body() body: { appId: string; version?: string; stack: string }) {
    const { appId, stack } = body
    let version = body.version

    // If version not supplied, use project's configured version
    if (!version) {
      const project = await this.projectsSvc.findByAppId(appId)
      version = project?.sourcemapVersion ?? 'latest'
    }

    return this.svc.resolveStack(appId, version, stack)
  }

  /**
   * Run `git pull` in the repository root to sync source maps committed by CI.
   * After calling this endpoint, the latest maps are available without any manual steps.
   */
  @Post('sync')
  @ApiOperation({ summary: 'git pull 同步 CI 提交的最新 source maps' })
  sync() {
    // Resolve repo root from this file's location: backend/src/sourcemaps → ../../../../
    const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', '..')
    try {
      const output = execSync('git pull --ff-only', {
        cwd: repoRoot,
        encoding: 'utf-8',
        timeout: 30_000,
      })
      return { ok: true, output: output.trim() }
    } catch (err: any) {
      throw new BadRequestException(`git pull failed: ${err.message ?? err}`)
    }
  }
}
