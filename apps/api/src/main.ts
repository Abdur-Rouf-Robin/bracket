import { NestFactory } from '@nestjs/core';

import { ValidationPipe } from '@nestjs/common';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import * as Sentry from '@sentry/node';

import { NestExpressApplication } from '@nestjs/platform-express';

import { join } from 'path';

import { AppModule } from './app.module';



function corsOrigins(): string[] | boolean {

  const raw = process.env.CORS_ORIGIN?.trim();

  if (!raw) return true;

  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);

  return list.length ? list : true;

}



async function bootstrap() {

  if (process.env.SENTRY_DSN) {

    Sentry.init({ dsn: process.env.SENTRY_DSN });

  }



  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  app.enableCors({

    origin: corsOrigins(),

    credentials: true,

  });

  app.useGlobalPipes(

    new ValidationPipe({

      transform: true,

      whitelist: false,

      forbidNonWhitelisted: false,

    }),

  );



  const config = new DocumentBuilder()

    .setTitle('Bracket API')

    .setDescription('Tournament bracket platform API')

    .setVersion('0.1.0')

    .addBearerAuth()

    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document);



  const port = Number(process.env.API_PORT ?? 3001);

  await app.listen(port);

  console.log(`API listening on http://localhost:${port}`);

  console.log(`Swagger at http://localhost:${port}/api/docs`);

}



bootstrap();


