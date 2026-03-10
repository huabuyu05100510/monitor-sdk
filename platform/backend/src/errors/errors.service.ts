import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, Between, FindOptionsWhere } from 'typeorm'
import { ErrorEvent } from './error-event.entity'
import { ProjectsService } from '../projects/projects.service'

export interface ReportDto {
  events: Array<{
    appId: string
    type: string
    subType: string
    timestamp: number
    url: string
    userAgent: string
    payload: Record<string, unknown>
  }>
}

export interface QueryDto {
  appId?: string
  type?: string
  subType?: string
  status?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

@Injectable()
export class ErrorsService {
  constructor(
    @InjectRepository(ErrorEvent)
    private readonly repo: Repository<ErrorEvent>,
    private readonly projectsService: ProjectsService,
  ) {}

  async report(dto: ReportDto): Promise<{ saved: number }> {
    const entities: ErrorEvent[] = []

    for (const raw of dto.events) {
      await this.projectsService.ensureByAppId(raw.appId)
      entities.push(
        this.repo.create({
          appId: raw.appId,
          type: raw.type,
          subType: raw.subType,
          timestamp: raw.timestamp,
          url: raw.url,
          userAgent: raw.userAgent,
          payload: raw.payload,
          status: 'new',
        }),
      )
    }

    await this.repo.save(entities)
    return { saved: entities.length }
  }

  async query(dto: QueryDto): Promise<{ data: ErrorEvent[]; total: number }> {
    const where: FindOptionsWhere<ErrorEvent> = {}
    if (dto.appId) where.appId = dto.appId
    if (dto.type) where.type = dto.type
    if (dto.subType) where.subType = dto.subType
    if (dto.status) where.status = dto.status as any

    const page = dto.page ?? 1
    const limit = dto.limit ?? 20
    const skip = (page - 1) * limit

    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    })

    return { data, total }
  }

  async findOne(id: string): Promise<ErrorEvent> {
    return this.repo.findOneBy({ id })
  }

  async updateAnalysis(
    id: string,
    status: ErrorEvent['status'],
    analysis: Record<string, unknown>,
  ): Promise<void> {
    await this.repo.update(id, { status, analysis })
  }

  /** 统计各 subType 的错误数量（用于趋势图） */
  async stats(appId: string): Promise<Record<string, number>> {
    const rows = await this.repo
      .createQueryBuilder('e')
      .select('e.subType', 'subType')
      .addSelect('COUNT(*)', 'count')
      .where('e.appId = :appId', { appId })
      .groupBy('e.subType')
      .getRawMany()

    return Object.fromEntries(rows.map((r) => [r.subType, Number(r.count)]))
  }

  /** 按天统计最近 7 天的错误数（用于折线图，兼容 SQLite 和 PostgreSQL） */
  async trend(appId: string): Promise<{ date: string; count: number }[]> {
    // Pull all events from the last 7 days and group in JS — works for both SQLite and PG
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const events = await this.repo
      .createQueryBuilder('e')
      .select('e.createdAt', 'createdAt')
      .where('e.appId = :appId', { appId })
      .andWhere('e.createdAt >= :since', { since: since.toISOString() })
      .getRawMany()

    const byDate: Record<string, number> = {}
    for (const e of events) {
      const day = new Date(e.createdAt).toISOString().slice(0, 10)
      byDate[day] = (byDate[day] ?? 0) + 1
    }

    return Object.entries(byDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }
}
