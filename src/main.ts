import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function parseCorsOrigins(value: string): string[] | string | boolean {
  if (value === '*') {
    return true;
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
    logger:
      nodeEnv === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 3001;
  const corsOrigins = configService.get<string>('corsOrigins') ?? '*';
  const upstreamDebug = configService.get<boolean>('upstreamDebugLog');

  app.enableCors({
    origin: parseCorsOrigins(corsOrigins),
    credentials: true,
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Accept-Language',
      'X-Request-Id',
      'X-Internal-Secret',
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: false,
      forbidUnknownValues: false,
    }),
  );

  await app.listen(port);
  Logger.log(`Ensmenu Mobile Gateway listening on port ${port}`, 'Bootstrap');
  if (upstreamDebug) {
    Logger.log('Upstream debug logging enabled (UPSTREAM_DEBUG_LOG)', 'Bootstrap');
  }
}

bootstrap();
