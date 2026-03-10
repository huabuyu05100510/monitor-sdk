import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ProjectsModule } from './projects/projects.module'
import { ErrorsModule } from './errors/errors.module'
import { SourcemapsModule } from './sourcemaps/sourcemaps.module'
import { AnalysisModule } from './analysis/analysis.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Priority: DATABASE_URL (Render/Heroku PG) > DB_TYPE config > SQLite
        const databaseUrl = config.get<string>('DATABASE_URL')
        if (databaseUrl) {
          return {
            type: 'postgres',
            url: databaseUrl,
            ssl: { rejectUnauthorized: false }, // required for Render free PG
            autoLoadEntities: true,
            synchronize: true,
          } as any
        }

        const useSqlite = config.get('DB_TYPE', 'sqlite') === 'sqlite'
        if (useSqlite) {
          return {
            type: 'better-sqlite3',
            database: config.get('SQLITE_PATH', '/tmp/monitor.db'),
            autoLoadEntities: true,
            synchronize: true,
          } as any
        }

        return {
          type: 'postgres',
          host: config.get('DB_HOST', 'localhost'),
          port: config.get<number>('DB_PORT', 5432),
          username: config.get('DB_USER', 'postgres'),
          password: config.get('DB_PASS', 'postgres'),
          database: config.get('DB_NAME', 'monitor_platform'),
          autoLoadEntities: true,
          synchronize: true,
        }
      },
    }),

    ProjectsModule,
    ErrorsModule,
    SourcemapsModule,
    AnalysisModule,
  ],
})
export class AppModule {}
