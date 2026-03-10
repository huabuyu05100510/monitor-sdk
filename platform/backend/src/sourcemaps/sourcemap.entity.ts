import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm'

@Entity('sourcemaps')
export class Sourcemap {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column()
  appId: string

  /** Commit hash or build version that this source map belongs to */
  @Index()
  @Column()
  version: string

  /** Original JS bundle filename (e.g. assets/index-CIo511wl.js) */
  @Index()
  @Column()
  filename: string

  /** Absolute path on disk where the .map file is stored */
  @Column()
  storagePath: string

  @CreateDateColumn()
  createdAt: Date
}
