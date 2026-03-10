import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ErrorEvent } from './error-event.entity'
import { ErrorsService } from './errors.service'
import { ErrorsController } from './errors.controller'
import { ProjectsModule } from '../projects/projects.module'

@Module({
  imports: [TypeOrmModule.forFeature([ErrorEvent]), ProjectsModule],
  providers: [ErrorsService],
  controllers: [ErrorsController],
  exports: [ErrorsService],
})
export class ErrorsModule {}
