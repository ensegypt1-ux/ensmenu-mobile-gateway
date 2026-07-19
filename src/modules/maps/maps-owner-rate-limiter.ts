import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type Bucket = { count: number; resetAt: number };

/**
 * Additional per-owner rate limit for maps proxy (on top of IP Throttler).
 */
@Injectable()
export class MapsOwnerRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly configService: ConfigService) {}

  check(ownerId: number): void {
    const limit =
      this.configService.get<number>('throttleMapsOwnerLimit') ?? 30;
    const ttlMs =
      this.configService.get<number>('throttleMapsOwnerTtlMs') ?? 60_000;
    const now = Date.now();
    const key = `owner:${ownerId}`;
    let bucket = this.buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + ttlMs };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > limit) {
      throw new HttpException(
        {
          error: 'maps_rate_limited',
          errorAr: 'تم تجاوز حد طلبات الخرائط',
          code: 'MAPS_RATE_LIMITED',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Opportunistic cleanup
    if (this.buckets.size > 5_000) {
      for (const [k, v] of this.buckets) {
        if (now >= v.resetAt) this.buckets.delete(k);
      }
    }
  }
}
