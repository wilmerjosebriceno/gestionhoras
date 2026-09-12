import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import helmet from 'helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { env } from './config/env.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Detrás de Nginx (proxy inverso): confiar en 1 salto para que req.ip
  // use la IP real del cliente (X-Forwarded-For) y el throttler no agrupe
  // a todos los usuarios bajo 127.0.0.1.
  app.set('trust proxy', 1);

  app.setGlobalPrefix('api');

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  const config = new DocumentBuilder()
    .setTitle('SIGESP - API de Seguridad')
    .setDescription('API REST para la gestión de seguridad del Sistema Integrado de Gestión')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Access Token JWT' },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  app.use(helmet());

  app.enableCors({
    origin: env.corsOrigin.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const port = env.port;
  await app.listen(port);
  console.log(`SIGESP API running on http://localhost:${port}/api/v1`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
