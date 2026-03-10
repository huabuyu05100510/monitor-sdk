import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'
import { ApiProperty } from '@nestjs/swagger'

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty()
  id: string

  @ApiProperty()
  @Column({ unique: true })
  appId: string

  @ApiProperty()
  @Column()
  name: string

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  description: string

  @ApiProperty()
  @Column({ default: true })
  active: boolean

  // ── Source Map 配置（用户可在项目设置页修改）──────────────────────────

  /**
   * 默认构建版本，用于自动匹配 Source Map。
   * 格式：git short-sha、语义版本号或任意字符串，与上传 .map 时填写的 version 一致。
   * 例：abc1234 / v1.2.3 / latest
   */
  @ApiProperty({ required: false, description: '默认 Source Map 版本（与上传时填写的 version 一致）' })
  @Column({ nullable: true, default: 'latest' })
  sourcemapVersion: string

  /**
   * Source Map 文件在服务器上的存储根目录（相对于后端工作目录或绝对路径）。
   * 留空时使用全局 SOURCEMAP_DIR 环境变量。
   * 例：./uploads/sourcemaps  /data/maps/my-app
   */
  @ApiProperty({ required: false, description: 'Source Map 存储目录（留空则使用全局 SOURCEMAP_DIR 配置）' })
  @Column({ nullable: true })
  sourcemapDir: string

  /**
   * 源码根目录（后端机器上的绝对路径或相对于后端工作目录的路径）。
   * 配置后，AI 分析会根据还原的文件路径直接读取该目录下的对应源码行。
   * 例：/Users/dev/my-app  ./../../demos/react-demo
   */
  @ApiProperty({ required: false, description: '源码根目录，用于 AI 分析时直接读取对应位置的源码' })
  @Column({ nullable: true })
  sourceRoot: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
