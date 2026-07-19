import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import {
  attachAuthIdentity,
  extractBearerToken,
  getAuthIdentity,
  verifyAccessToken,
} from './jwt-payload.util';

describe('jwt-payload.util', () => {
  const secret = 'a'.repeat(32);
  const refreshSecret = 'b'.repeat(32);

  const configService = {
    get: (key: string) => {
      if (key === 'jwtAccessSecret') return secret;
      return undefined;
    },
  } as ConfigService;

  it('verifies a valid Owner access token', () => {
    const token = jwt.sign(
      { id: 42, userId: 42, role: 'user', email: 'o@example.com' },
      secret,
      { algorithm: 'HS256', expiresIn: '15m' },
    );
    const identity = verifyAccessToken(token, configService);
    expect(identity.userId).toBe(42);
    expect(identity.role).toBe('user');
  });

  it('rejects a refresh token signed with a different secret', () => {
    const token = jwt.sign(
      { id: 42, userId: 42, role: 'user' },
      refreshSecret,
      { algorithm: 'HS256', expiresIn: '7d' },
    );
    expect(() => verifyAccessToken(token, configService)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects forged / incorrectly signed tokens', () => {
    const token = jwt.sign(
      { id: 1, userId: 1, role: 'user' },
      'wrong-secret-wrong-secret-wrong!!',
      { algorithm: 'HS256', expiresIn: '15m' },
    );
    expect(() => verifyAccessToken(token, configService)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects expired tokens with TOKEN_EXPIRED', () => {
    const token = jwt.sign(
      { id: 1, userId: 1, role: 'user' },
      secret,
      { algorithm: 'HS256', expiresIn: -10 },
    );
    try {
      verifyAccessToken(token, configService);
      fail('expected UnauthorizedException');
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      const response = (err as UnauthorizedException).getResponse() as {
        code?: string;
      };
      expect(response.code).toBe('TOKEN_EXPIRED');
    }
  });

  it('rejects wrong-signature tokens with AUTH_INVALID_TOKEN', () => {
    const token = jwt.sign(
      { id: 1, userId: 1, role: 'user' },
      'wrong-secret-wrong-secret-wrong!!',
      { algorithm: 'HS256', expiresIn: '15m' },
    );
    try {
      verifyAccessToken(token, configService);
      fail('expected UnauthorizedException');
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      const response = (err as UnauthorizedException).getResponse() as {
        code?: string;
      };
      expect(response.code).toBe('AUTH_INVALID_TOKEN');
    }
  });

  it('returns AUTH_MISCONFIGURED when access secret is missing', () => {
    const emptyConfig = {
      get: () => undefined,
    } as unknown as ConfigService;
    try {
      verifyAccessToken('anything', emptyConfig);
      fail('expected UnauthorizedException');
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      const response = (err as UnauthorizedException).getResponse() as {
        code?: string;
      };
      expect(response.code).toBe('AUTH_MISCONFIGURED');
    }
  });

  it('never verifies with the refresh-token secret', () => {
    const refreshOnlyConfig = {
      get: (key: string) => {
        if (key === 'jwtAccessSecret') return undefined;
        if (key === 'jwtRefreshSecret') return refreshSecret;
        return undefined;
      },
    } as unknown as ConfigService;
    const token = jwt.sign(
      { id: 1, userId: 1, role: 'user' },
      refreshSecret,
      { algorithm: 'HS256', expiresIn: '15m' },
    );
    try {
      verifyAccessToken(token, refreshOnlyConfig);
      fail('expected UnauthorizedException');
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      const response = (err as UnauthorizedException).getResponse() as {
        code?: string;
      };
      expect(response.code).toBe('AUTH_MISCONFIGURED');
    }
  });

  it('accepts staff access tokens without exp', () => {
    const token = jwt.sign(
      { id: 9, userId: 9, role: 'staff', menuId: 3, staffRoleId: 7 },
      secret,
      { algorithm: 'HS256' },
    );
    const identity = verifyAccessToken(token, configService);
    expect(identity.role).toBe('staff');
    expect(identity.menuId).toBe(3);
    expect(identity.staffRoleId).toBe(7);
  });

  it('accepts access tokens without optional role claim', () => {
    const token = jwt.sign(
      { id: 11, userId: 11, email: 'x@example.com' },
      secret,
      { algorithm: 'HS256', expiresIn: '15m' },
    );
    const identity = verifyAccessToken(token, configService);
    expect(identity.userId).toBe(11);
    expect(identity.role).toBe('user');
  });

  it('attaches immutable identity on the request', () => {
    const token = jwt.sign(
      { id: 5, userId: 5, role: 'admin' },
      secret,
      { algorithm: 'HS256', expiresIn: '15m' },
    );
    const identity = verifyAccessToken(token, configService);
    const req = {
      headers: { authorization: `Bearer ${token}` },
    } as import('express').Request;
    attachAuthIdentity(req, identity);
    expect(extractBearerToken(req)).toBe(token);
    expect(getAuthIdentity(req)?.userId).toBe(5);
  });
});
