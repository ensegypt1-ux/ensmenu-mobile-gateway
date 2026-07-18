import { EnsHttpResult } from '../../infrastructure/ens-backend/ens-http.service';

/** Stable mobile-facing code for confirmed Bearer JWT access-token expiry. */
export const TOKEN_EXPIRED_CODE = 'TOKEN_EXPIRED';

const TOKEN_EXPIRED_EN = 'token expired';
const TOKEN_EXPIRED_AR = 'انتهت صلاحية الرمز';

/** Upstream messages that indicate API-key / credential problems — never JWT expiry. */
const API_KEY_FAILURE_MARKERS = [
  'no token provided',
  'invalid token format',
  'failed to decrypt',
  'failed to decrypt or validate api key',
  'api key',
  'x-api-key',
];

function asRecord(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  return data as Record<string, unknown>;
}

function text(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function lower(value: unknown): string {
  return text(value).toLowerCase();
}

/**
 * True when the upstream body clearly means Bearer JWT access-token expiry
 * (Express auth.middleware TokenExpiredError), not a generic 405 / API-key issue.
 */
export function upstreamBodyIndicatesJwtAccessExpired(data: unknown): boolean {
  const body = asRecord(data);
  if (!body) return false;

  const nested = asRecord(body.message);
  const payload = nested ?? body;

  const code = lower(payload.code ?? payload.errorType);
  if (code === 'token_expired' || code === 'jwt_expired') {
    return true;
  }

  const candidates = [
    payload.errorEn,
    payload.error,
    payload.message,
    payload.errorAr,
  ];

  for (const raw of candidates) {
    const value = text(raw);
    if (!value) continue;
    const normalized = value.toLowerCase();

    if (API_KEY_FAILURE_MARKERS.some((m) => normalized.includes(m))) {
      return false;
    }

    if (
      normalized === TOKEN_EXPIRED_EN ||
      normalized === 'jwt expired' ||
      value === TOKEN_EXPIRED_AR
    ) {
      return true;
    }
  }

  return false;
}

export function hasBearerAuthorization(
  headers: Record<string, string> | undefined,
): boolean {
  if (!headers) return false;
  const raw =
    headers.authorization ??
    headers.Authorization ??
    Object.entries(headers).find(([k]) => k.toLowerCase() === 'authorization')?.[1];
  return typeof raw === 'string' && raw.toLowerCase().startsWith('bearer ');
}

/**
 * Normalize confirmed upstream JWT access-token expiry to a stable mobile contract.
 * Does not rewrite generic 405s, API-key failures, or responses without a Bearer token.
 */
export function normalizeUpstreamAuthError(
  result: EnsHttpResult,
  upstreamHeaders?: Record<string, string>,
): EnsHttpResult {
  if (result.status !== 401 && result.status !== 405) {
    return result;
  }

  if (!hasBearerAuthorization(upstreamHeaders)) {
    return result;
  }

  if (!upstreamBodyIndicatesJwtAccessExpired(result.data)) {
    return result;
  }

  const body = asRecord(result.data) ?? {};
  const errorEn = text(body.errorEn) || 'Token expired';
  const errorAr = text(body.errorAr) || TOKEN_EXPIRED_AR;
  const primary =
    text(body.error) ||
    (lower(body.error) === lower(errorAr) ? errorAr : errorEn);

  return {
    status: 401,
    data: {
      ...body,
      error: primary,
      errorEn,
      errorAr,
      code: TOKEN_EXPIRED_CODE,
    },
  };
}
