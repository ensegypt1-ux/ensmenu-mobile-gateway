import { applyDecorators } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Stricter limit for login / signup / refresh / password reset / Google auth. */
export function AuthThrottle() {
  return applyDecorators(
    Throttle({
      default: {
        limit: () => envInt('THROTTLE_AUTH_LIMIT', 20),
        ttl: () => envInt('THROTTLE_AUTH_TTL_MS', 60_000),
      },
    }),
  );
}

/** Stricter limit for payment initiate, upload, and menu import. */
export function SensitiveThrottle() {
  return applyDecorators(
    Throttle({
      default: {
        limit: () => envInt('THROTTLE_SENSITIVE_LIMIT', 40),
        ttl: () => envInt('THROTTLE_SENSITIVE_TTL_MS', 60_000),
      },
    }),
  );
}

/** Places autocomplete / details / geocode (owner maps proxy). */
export function MapsThrottle() {
  return applyDecorators(
    Throttle({
      default: {
        limit: () => envInt('THROTTLE_MAPS_LIMIT', 30),
        ttl: () => envInt('THROTTLE_MAPS_TTL_MS', 60_000),
      },
    }),
  );
}

/** Health probes and similarly always-public checks — no rate limit. */
export function SkipRateLimit() {
  return applyDecorators(SkipThrottle());
}
