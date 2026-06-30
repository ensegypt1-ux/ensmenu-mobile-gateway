import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const started = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - started;
          const status = response.statusCode;
          const line = `${request.method} ${request.originalUrl} ${status} ${duration}ms`;
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
          this.logger.error(
            `${request.method} ${request.originalUrl} failed ${duration}ms — ${message}`,
          );
        },
      }),
    );
  }
}
