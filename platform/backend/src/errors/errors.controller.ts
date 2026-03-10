import { Controller, Post, Get, Param, Body, Query } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { ErrorsService, ReportDto, QueryDto } from './errors.service'

@ApiTags('errors')
@Controller('errors')
export class ErrorsController {
  constructor(private readonly svc: ErrorsService) {}

  /** SDK 上报入口 — 对应 MonitorConfig.dsn */
  @Post('report')
  @ApiOperation({ summary: 'SDK 上报事件（接收 sendBeacon / fetch 上报）' })
  report(@Body() body: ReportDto) {
    return this.svc.report(body)
  }

  @Get()
  @ApiOperation({ summary: '查询错误列表' })
  query(@Query() query: QueryDto) {
    return this.svc.query(query)
  }

  @Get('stats/:appId')
  @ApiOperation({ summary: '按 subType 统计错误数' })
  stats(@Param('appId') appId: string) {
    return this.svc.stats(appId)
  }

  @Get('trend/:appId')
  @ApiOperation({ summary: '近 7 天错误趋势' })
  trend(@Param('appId') appId: string) {
    return this.svc.trend(appId)
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单条错误详情' })
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id)
  }
}
