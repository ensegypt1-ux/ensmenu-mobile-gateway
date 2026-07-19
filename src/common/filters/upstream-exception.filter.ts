import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class UpstreamExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(UpstreamExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      response.status(status).json(this.normalize(payload, status, request));
      return;
    }

    this.logger.error(
      `Unhandled gateway error on ${request.method} ${request.path}: ${
        exception instanceof Error ? exception.message : String(exception)
      }`,
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal gateway error',
      errorAr: 'خطأ داخلي في البوابة',
      code: 'GATEWAY_ERROR',
      requestId: this.safeRequestId(request),
    });
  }

  private safeRequestId(request: Request): string | undefined {
    const raw = request.headers['x-request-id'];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 64) return undefined;
    if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) return undefined;
    return trimmed;
  }

  private normalize(
    payload: string | object,
    statusCode: number,
    request: Request,
  ): Record<string, unknown> {
    const requestId = this.safeRequestId(request);

    if (typeof payload === 'string') {
      return {
        statusCode,
        error: payload,
        requestId,
      };
    }

    const record = payload as Record<string, unknown>;
    // Whitelist client-visible fields — never spread raw exception payloads
    // (prevents leaking `detail`, stacks, webhook snippets, etc.).
    const out: Record<string, unknown> = {
      statusCode: record.statusCode ?? statusCode,
      error: record.error ?? record.message,
      errorAr: record.errorAr,
      code: record.code,
      requestId,
    };

    if (record.isLocked != null) out.isLocked = record.isLocked;
    if (record.lockedUntil != null) out.lockedUntil = record.lockedUntil;

    return out;
  }
}
