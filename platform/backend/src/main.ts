import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((o) => o.trim())

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. sendBeacon, curl, Swagger)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`))
      }
    },
    credentials: true,
  })

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  app.setGlobalPrefix('api')

  const config = new DocumentBuilder()
    .setTitle('Monitor Platform API')
    .setDescription('前端监控平台 — 错误接收、Source Map 解析、AI 根因分析')
    .setVersion('1.0')
    .build()
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/docs', app, document)

  const port = process.env.PORT ?? 4000
  await app.listen(port)
  console.log(`🚀  Monitor Platform backend running on http://localhost:${port}`)
  console.log(`📖  Swagger docs: http://localhost:${port}/api/docs`)
}

bootstrap()
