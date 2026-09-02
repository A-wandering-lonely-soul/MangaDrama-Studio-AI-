import 'dotenv/config';
import 'reflect-metadata';
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

  await app.listen(appConfig.port);
}

void bootstrap();