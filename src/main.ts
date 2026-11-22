import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get(ConfigService);
  const port = Number(process.env.PORT) || configService.get<number>('PORT', 3001);
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:3000');
  const isProduction = process.env.NODE_ENV === 'production';

  // Behind Nginx: trust the first proxy hop so req.ip is the real client address.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  // Close DB connections cleanly when Docker stops the container (SIGTERM).
  app.enableShutdownHooks();

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: corsOrigin.split(',').map((o) => {
      const origin = o.trim();
      return origin.endsWith('/') ? origin.slice(0, -1) : origin;
    }),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // API docs describe every endpoint; keep them off the public internet unless explicitly enabled.
  const swaggerEnabled = !isProduction || process.env.ENABLE_SWAGGER === 'true';
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Raj Foods EMS API')
      .setDescription('Inventory, Contract, Production & Dispatch Management')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(port, '0.0.0.0');
  logger.log(`API listening on port ${port} (prefix /api/v1, env=${process.env.NODE_ENV ?? 'development'})`);
  if (swaggerEnabled) logger.log(`Swagger docs at /api/docs`);
}

bootstrap();
