import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LoginDebugLogger {
  private readonly logger = new Logger('AuthLoginDebug');

  logProxyAttempt(input: {
    gatewayRoute: string;
    upstreamUrl: string;
    upstreamStatus: number;
    upstreamBody: unknown;
  }): void {
    this.logger.log(`gateway route: ${input.gatewayRoute}`);
    this.logger.log(`upstream URL: ${input.upstreamUrl}`);
    this.logger.log(`upstream status: ${input.upstreamStatus}`);
    this.logger.log(
      `upstream body: ${JSON.stringify(this.sanitizeBody(input.upstreamBody))}`,
    );
  }

  private sanitizeBody(body: unknown): unknown {
    if (body === null || body === undefined) {
      return body;
    }

    if (typeof body !== 'object') {
      return body;
    }

    if (Array.isArray(body)) {
      return body.map((item) => this.sanitizeBody(item));
    }

    const record = body as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(record)) {
      const lower = key.toLowerCase();
      if (
        lower.includes('password') ||
        lower.includes('token') ||
        lower === 'accesstoken' ||
        lower === 'refreshtoken'
      ) {
        sanitized[key] = '[REDACTED]';
        continue;
      }
      sanitized[key] = this.sanitizeBody(value);
    }

    return sanitized;
  }
}
