import {
  hasBearerAuthorization,
  normalizeUpstreamAuthError,
  TOKEN_EXPIRED_CODE,
  upstreamBodyIndicatesJwtAccessExpired,
} from './upstream-auth-error.util';

describe('upstream-auth-error.util', () => {
  describe('upstreamBodyIndicatesJwtAccessExpired', () => {
    it('matches English Token expired via errorEn', () => {
      expect(
        upstreamBodyIndicatesJwtAccessExpired({
          error: 'انتهت صلاحية الرمز',
          errorAr: 'انتهت صلاحية الرمز',
          errorEn: 'Token expired',
        }),
      ).toBe(true);
    });

    it('matches Arabic primary error text', () => {
      expect(
        upstreamBodyIndicatesJwtAccessExpired({
          error: 'انتهت صلاحية الرمز',
          errorAr: 'انتهت صلاحية الرمز',
          errorEn: 'Token expired',
        }),
      ).toBe(true);
    });

    it('matches English primary error text', () => {
      expect(
        upstreamBodyIndicatesJwtAccessExpired({
          error: 'Token expired',
          errorAr: 'انتهت صلاحية الرمز',
          errorEn: 'Token expired',
        }),
      ).toBe(true);
    });

    it('rejects API-key decrypt failures', () => {
      expect(
        upstreamBodyIndicatesJwtAccessExpired({
          error: 'Failed to decrypt or validate API key: bad key',
          errorEn: 'Failed to decrypt or validate API key: bad key',
        }),
      ).toBe(false);
    });

    it('rejects missing token / invalid format', () => {
      expect(
        upstreamBodyIndicatesJwtAccessExpired({
          error: 'No token provided',
          errorEn: 'No token provided',
        }),
      ).toBe(false);
      expect(
        upstreamBodyIndicatesJwtAccessExpired({
          error: 'Invalid token format',
          errorEn: 'Invalid token format',
        }),
      ).toBe(false);
    });

    it('rejects generic Method Not Allowed style bodies', () => {
      expect(
        upstreamBodyIndicatesJwtAccessExpired({
          error: 'Method Not Allowed',
        }),
      ).toBe(false);
    });

    it('rejects Invalid or expired token without TOKEN_EXPIRED code', () => {
      expect(
        upstreamBodyIndicatesJwtAccessExpired({
          error: 'Invalid or expired token',
          errorEn: 'Invalid or expired token',
        }),
      ).toBe(false);
    });
  });

  describe('hasBearerAuthorization', () => {
    it('detects Bearer header case-insensitively', () => {
      expect(hasBearerAuthorization({ authorization: 'Bearer abc' })).toBe(
        true,
      );
      expect(hasBearerAuthorization({ Authorization: 'Bearer abc' })).toBe(
        true,
      );
      expect(hasBearerAuthorization({ authorization: 'Basic abc' })).toBe(
        false,
      );
      expect(hasBearerAuthorization({})).toBe(false);
    });
  });

  describe('normalizeUpstreamAuthError', () => {
    const expiredBody = {
      error: 'انتهت صلاحية الرمز',
      errorAr: 'انتهت صلاحية الرمز',
      errorEn: 'Token expired',
    };

    it('normalizes 405 JWT expiry with Bearer to 401 TOKEN_EXPIRED', () => {
      const result = normalizeUpstreamAuthError(
        { status: 405, data: expiredBody },
        { authorization: 'Bearer access.jwt' },
      );
      expect(result.status).toBe(401);
      expect(result.data).toMatchObject({
        code: TOKEN_EXPIRED_CODE,
        errorEn: 'Token expired',
        errorAr: 'انتهت صلاحية الرمز',
        error: 'انتهت صلاحية الرمز',
      });
    });

    it('normalizes 401 JWT expiry body with Bearer to TOKEN_EXPIRED', () => {
      const result = normalizeUpstreamAuthError(
        { status: 401, data: { ...expiredBody, error: 'Token expired' } },
        { authorization: 'Bearer access.jwt' },
      );
      expect(result.status).toBe(401);
      expect((result.data as { code: string }).code).toBe(TOKEN_EXPIRED_CODE);
    });

    it('does not normalize 405 without Bearer (API-key / public)', () => {
      const result = normalizeUpstreamAuthError(
        { status: 405, data: expiredBody },
        {},
      );
      expect(result.status).toBe(405);
      expect((result.data as { code?: string }).code).toBeUndefined();
    });

    it('does not normalize generic 405', () => {
      const result = normalizeUpstreamAuthError(
        { status: 405, data: { error: 'Method Not Allowed' } },
        { authorization: 'Bearer access.jwt' },
      );
      expect(result.status).toBe(405);
      expect(result.data).toEqual({ error: 'Method Not Allowed' });
    });

    it('does not normalize API-key decrypt 401', () => {
      const body = {
        error: 'Failed to decrypt or validate API key: error',
        errorEn: 'Failed to decrypt or validate API key: error',
      };
      const result = normalizeUpstreamAuthError(
        { status: 401, data: body },
        { authorization: 'Bearer access.jwt' },
      );
      expect(result.status).toBe(401);
      expect((result.data as { code?: string }).code).toBeUndefined();
      expect(result.data).toEqual(body);
    });

    it('preserves unrelated statuses', () => {
      const result = normalizeUpstreamAuthError(
        { status: 403, data: { error: 'Forbidden' } },
        { authorization: 'Bearer access.jwt' },
      );
      expect(result).toEqual({
        status: 403,
        data: { error: 'Forbidden' },
      });
    });
  });
});
