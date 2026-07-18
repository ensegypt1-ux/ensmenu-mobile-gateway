import {
  assertSafePathSegment,
  assertUrlInsideApiBase,
  sanitizeUpstreamPath,
} from './upstream-path.util';

describe('upstream-path.util', () => {
  describe('assertSafePathSegment', () => {
    it('accepts normal ids and filenames', () => {
      expect(assertSafePathSegment('42')).toBe('42');
      expect(assertSafePathSegment('photo.webp')).toBe('photo.webp');
      expect(assertSafePathSegment('ord_abc-1')).toBe('ord_abc-1');
    });

    it('rejects traversal and separators', () => {
      expect(() => assertSafePathSegment('..')).toThrow();
      expect(() => assertSafePathSegment('../secret')).toThrow();
      expect(() => assertSafePathSegment('%2e%2e')).toThrow();
      expect(() => assertSafePathSegment('a/b')).toThrow();
      expect(() => assertSafePathSegment('')).toThrow();
    });
  });

  describe('sanitizeUpstreamPath', () => {
    it('encodes safe multi-segment paths', () => {
      expect(sanitizeUpstreamPath('/menus/12/items/3')).toBe('menus/12/items/3');
      expect(sanitizeUpstreamPath('upload/my file.png')).toBe(
        'upload/my%20file.png',
      );
    });

    it('rejects path traversal', () => {
      expect(() => sanitizeUpstreamPath('menus/../user')).toThrow();
      expect(() => sanitizeUpstreamPath('upload/../../secret')).toThrow();
      expect(() => sanitizeUpstreamPath('menus//1')).toThrow();
    });
  });

  describe('assertUrlInsideApiBase', () => {
    const base = 'https://ensapi.ensbot.net/api';

    it('allows urls under the api base', () => {
      expect(() =>
        assertUrlInsideApiBase(
          'https://ensapi.ensbot.net/api/menus/1',
          base,
        ),
      ).not.toThrow();
    });

    it('rejects escape from api base', () => {
      expect(() =>
        assertUrlInsideApiBase('https://ensapi.ensbot.net/secret', base),
      ).toThrow();
      expect(() =>
        assertUrlInsideApiBase('https://evil.example/api/menus/1', base),
      ).toThrow();
    });
  });
});
