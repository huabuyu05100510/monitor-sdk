import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.enableCors({
    // Reflect the request origin — allows any origin (localhost tunnels, GitHub Pages, etc.)
    // Safe for a local dev monitoring backend since it's not publicly deployed.
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })

  // Allow Chrome's Private Network Access: HTTPS pages (GitHub Pages) calling http://localhost
  app.use((_req: any, res: any, next: any) => {
    res.setHeader('Access-Control-Allow-Private-Network', 'true')
    next()
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
