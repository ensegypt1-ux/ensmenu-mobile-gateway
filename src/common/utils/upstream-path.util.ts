import { BadRequestException } from '@nestjs/common';

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * Validates a single upstream path segment (menuId, filename, orderId, …).
 * Rejects traversal, separators, and empty/malformed values.
 */
export function assertSafePathSegment(
  raw: string,
  label = 'path segment',
): string {
  const value = String(raw ?? '').trim();
  if (!value) {
    throw new BadRequestException({
      error: `Invalid ${label}`,
      errorAr: 'معرّف غير صالح',
      code: 'INVALID_PATH_SEGMENT',
    });
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw new BadRequestException({
      error: `Invalid ${label}`,
      errorAr: 'معرّف غير صالح',
      code: 'INVALID_PATH_SEGMENT',
    });
  }

  if (
    decoded === '.' ||
    decoded === '..' ||
    decoded.includes('/') ||
    decoded.includes('\\') ||
    decoded.includes('\0') ||
    CONTROL_CHARS.test(decoded) ||
    /%2e/i.test(value) ||
    /%2f/i.test(value) ||
    /%5c/i.test(value)
  ) {
    throw new BadRequestException({
      error: `Invalid ${label}`,
      errorAr: 'معرّف غير صالح',
      code: 'INVALID_PATH_SEGMENT',
    });
  }

  return decoded;
}

/**
 * Sanitizes a relative upstream API path (no leading slash).
 * Each segment is validated and percent-encoded.
 */
export function sanitizeUpstreamPath(path: string): string {
  const normalized = String(path ?? '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');

  if (!normalized) {
    throw new BadRequestException({
      error: 'Invalid upstream path',
      errorAr: 'مسار غير صالح',
      code: 'INVALID_UPSTREAM_PATH',
    });
  }

  if (normalized.includes('\\') || CONTROL_CHARS.test(normalized)) {
    throw new BadRequestException({
      error: 'Invalid upstream path',
      errorAr: 'مسار غير صالح',
      code: 'INVALID_UPSTREAM_PATH',
    });
  }

  const segments = normalized.split('/');
  if (segments.some((s) => s.length === 0)) {
    throw new BadRequestException({
      error: 'Invalid upstream path',
      errorAr: 'مسار غير صالح',
      code: 'INVALID_UPSTREAM_PATH',
    });
  }

  return segments
    .map((segment) => encodeURIComponent(assertSafePathSegment(segment)))
    .join('/');
}

/**
 * Ensures [resolvedUrl] stays under [apiBaseUrl] (scheme/host/port + /api prefix).
 */
export function assertUrlInsideApiBase(
  resolvedUrl: string,
  apiBaseUrl: string,
): void {
  let resolved: URL;
  let base: URL;
  try {
    resolved = new URL(resolvedUrl);
    base = new URL(apiBaseUrl.endsWith('/') ? apiBaseUrl : `${apiBaseUrl}/`);
  } catch {
    throw new BadRequestException({
      error: 'Invalid upstream path',
      errorAr: 'مسار غير صالح',
      code: 'INVALID_UPSTREAM_PATH',
    });
  }

  if (resolved.origin !== base.origin) {
    throw new BadRequestException({
      error: 'Invalid upstream path',
      errorAr: 'مسار غير صالح',
      code: 'INVALID_UPSTREAM_PATH',
    });
  }

  const basePath = base.pathname.replace(/\/+$/, '') || '';
  const resolvedPath = resolved.pathname.replace(/\/+$/, '') || '';
  if (basePath && !resolvedPath.startsWith(basePath)) {
    throw new BadRequestException({
      error: 'Invalid upstream path',
      errorAr: 'مسار غير صالح',
      code: 'INVALID_UPSTREAM_PATH',
    });
  }
}
