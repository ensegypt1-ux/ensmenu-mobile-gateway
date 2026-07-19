import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

const SENSITIVE_QUERY_KEYS = new Set([
  'token',
  'access_token',
  'refresh_token',
  'password',
  'secret',
  'api_key',
  'apikey',
  'authorization',
  'code',
  'id_token',
]);

function redactUrl(originalUrl: string): string {
  const qIndex = originalUrl.indexOf('?');
  if (qIndex < 0) return originalUrl;

  const path = originalUrl.slice(0, qIndex);
  const search = originalUrl.slice(qIndex + 1);
  const params = new URLSearchParams(search);
  const redacted = new URLSearchParams();

  for (const [key, value] of params.entries()) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
      redacted.set(key, '[REDACTED]');
    } else if (value.length > 120) {
      redacted.set(key, `${value.slice(0, 40)}…`);
    } else {
      redacted.set(key, value);
    }
  }

  const qs = redacted.toString();
  return qs ? `${path}?${qs}` : path;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const started = Date.now();
    const safeUrl = redactUrl(request.originalUrl || request.url || '');

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - started;
          const status = response.statusCode;
          const line = `${request.method} ${safeUrl} ${status} ${duration}ms`;
          if (status >= 400) {
            this.logger.warn(line);
          } else {
            this.logger.log(line);
          }
        },
        error: (err: unknown) => {
          const duration = Date.now() - started;
          const message =
            err instanceof Error ? err.message : String(err ?? 'error');
          // Never log Authorization headers or tokens.
          this.logger.error(
            `${request.method} ${safeUrl} failed ${duration}ms — ${message}`,
          );
        },
      }),
    );
  }
}
