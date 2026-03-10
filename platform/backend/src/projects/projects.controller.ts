import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { ProjectsService } from './projects.service'
import { Project } from './project.entity'

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly svc: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: '获取所有项目' })
  findAll(): Promise<Project[]> {
    return this.svc.findAll()
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单个项目' })
  findOne(@Param('id') id: string): Promise<Project> {
    return this.svc.findOne(id)
  }

  @Post()
  @ApiOperation({ summary: '创建项目' })
  create(@Body() body: Partial<Project>): Promise<Project> {
    return this.svc.create(body)
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新项目' })
  update(@Param('id') id: string, @Body() body: Partial<Project>): Promise<Project> {
    return this.svc.update(id, body)
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除项目' })
  remove(@Param('id') id: string): Promise<void> {
    return this.svc.remove(id)
  }
}
