import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm'
import { ApiProperty } from '@nestjs/swagger'

export type ErrorStatus = 'new' | 'analyzing' | 'analyzed' | 'resolved'

@Entity('error_events')
export class ErrorEvent {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty()
  id: string

  @Index()
  @Column()
  @ApiProperty()
  appId: string

  @Index()
  @Column()
  @ApiProperty({ enum: ['error', 'request', 'white-screen'] })
  type: string

  @Column()
  @ApiProperty()
  subType: string

  @Column({ type: 'bigint' })
  @ApiProperty()
  timestamp: number

  @Column()
  @ApiProperty()
  url: string

  @Column({ nullable: true })
  @ApiProperty()
  userAgent: string

  @Column({ type: 'simple-json', default: '{}' })
  @ApiProperty()
  payload: Record<string, unknown>

  @Column({ default: 'new' })
  @ApiProperty({ enum: ['new', 'analyzing', 'analyzed', 'resolved'] })
  status: ErrorStatus

  /** AI 分析结果，analyzing 完成后写入 */
  @Column({ type: 'simple-json', nullable: true })
  @ApiProperty({ required: false })
  analysis: Record<string, unknown> | null

  @CreateDateColumn()
  createdAt: Date
}
