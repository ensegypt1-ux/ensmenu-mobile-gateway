import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const configured = this.configService
      .get<string>('internalNotificationsSecret')
      ?.trim();

    if (!configured) {
      throw new UnauthorizedException({
        error: 'Internal notifications are not configured',
        errorAr: 'إرسال الإشعارات الداخلي غير مهيأ',
        code: 'INTERNAL_NOTIFICATIONS_MISCONFIGURED',
      });
    }

    const provided = request.headers['x-internal-secret'];
    const secret = Array.isArray(provided) ? provided[0] : provided;

    if (typeof secret !== 'string' || secret.trim() !== configured) {
      throw new UnauthorizedException({
        error: 'Invalid internal secret',
        errorAr: 'رمز الإرسال الداخلي غير صالح',
        code: 'INTERNAL_SECRET_INVALID',
      });
    }

    return true;
  }
}
