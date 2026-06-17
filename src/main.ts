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
  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 3001;
  const corsOrigins = configService.get<string>('corsOrigins') ?? '*';

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
}

bootstrap();
