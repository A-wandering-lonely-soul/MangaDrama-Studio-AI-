import 'dotenv/config';
import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import express from 'express';
import { NestFactory } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { getAppConfig } from './config/app.config';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const appConfig = getAppConfig();
  const app = await NestFactory.create(AppModule, {
    cors: false
  });

  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({
    origin: appConfig.corsOrigins === '*' ? true : appConfig.corsOrigins
  });

  const staticDirs = [join(process.cwd(), 'static'), join(process.cwd(), '..', 'static')];
  for (const staticDir of staticDirs) {
    if (existsSync(staticDir)) {
      app.use('/static', express.static(staticDir));
    }
  }

  await app.listen(appConfig.port);
}

void bootstrap();