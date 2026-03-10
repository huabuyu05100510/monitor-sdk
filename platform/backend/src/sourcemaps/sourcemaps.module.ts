import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Sourcemap } from './sourcemap.entity'
import { SourcemapsService } from './sourcemaps.service'
import { SourcemapsController } from './sourcemaps.controller'
import { ProjectsModule } from '../projects/projects.module'

@Module({
  imports: [TypeOrmModule.forFeature([Sourcemap]), ProjectsModule],
  providers: [SourcemapsService],
  controllers: [SourcemapsController],
  exports: [SourcemapsService],
})
export class SourcemapsModule {}
