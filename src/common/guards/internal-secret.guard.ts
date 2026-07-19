import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const configured = this.configService
      .get<string>('internalNotificationsSecret')
      ?.trim();

    if (!configured || configured.length < 32) {
      throw new UnauthorizedException({
        error: 'Internal notifications are not configured',
        errorAr: 'إرسال الإشعارات الداخلي غير مهيأ',
        code: 'INTERNAL_NOTIFICATIONS_MISCONFIGURED',
      });
    }

    const provided = request.headers['x-internal-secret'];
    const secret = Array.isArray(provided) ? provided[0] : provided;

    if (typeof secret !== 'string' || !this.secretsEqual(secret, configured)) {
      throw new UnauthorizedException({
        error: 'Invalid internal secret',
        errorAr: 'رمز الإرسال الداخلي غير صالح',
        code: 'INTERNAL_SECRET_INVALID',
      });
    }

    return true;
  }

  private secretsEqual(provided: string, expected: string): boolean {
    const a = Buffer.from(provided, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) {
      // Compare against expected length to avoid leaking length via early return timing
      // while still rejecting mismatched lengths.
      timingSafeEqual(b, b);
      return false;
    }
    return timingSafeEqual(a, b);
  }
}
