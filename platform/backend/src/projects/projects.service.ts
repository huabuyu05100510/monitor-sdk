import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Project } from './project.entity'

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly repo: Repository<Project>,
  ) {}

  findAll(): Promise<Project[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } })
  }

  async findOne(id: string): Promise<Project> {
    const p = await this.repo.findOneBy({ id })
    if (!p) throw new NotFoundException(`Project ${id} not found`)
    return p
  }

  async findByAppId(appId: string): Promise<Project | null> {
    return this.repo.findOneBy({ appId })
  }

  async ensureByAppId(appId: string): Promise<Project> {
    let p = await this.repo.findOneBy({ appId })
    if (!p) {
      p = this.repo.create({ appId, name: appId })
      await this.repo.save(p)
    }
    return p
  }

  create(data: Partial<Project>): Promise<Project> {
    const p = this.repo.create(data)
    return this.repo.save(p)
  }

  async update(id: string, data: Partial<Project>): Promise<Project> {
    await this.repo.update(id, data)
    return this.findOne(id)
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id)
  }
}
