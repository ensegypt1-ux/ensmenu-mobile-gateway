import {
  detectImageMimeFromBuffer,
  resolveSafeImageContentType,
} from './image-file.util';

describe('image-file.util', () => {
  it('detects JPEG magic bytes', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(detectImageMimeFromBuffer(buf)).toBe('image/jpeg');
  });

  it('detects PNG magic bytes', () => {
    const buf = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
    ]);
    expect(detectImageMimeFromBuffer(buf)).toBe('image/png');
  });

  it('detects WebP magic bytes', () => {
    const buf = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(detectImageMimeFromBuffer(buf)).toBe('image/webp');
  });

  it('rejects non-image buffers even with image extension', () => {
    const file = {
      buffer: Buffer.from('not an image'),
      mimetype: 'image/jpeg',
      originalname: 'x.jpg',
    } as Express.Multer.File;
    expect(resolveSafeImageContentType(file)).toBeNull();
  });

  it('rejects MIME mismatch vs magic bytes', () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
    ]);
    const file = {
      buffer: png,
      mimetype: 'image/jpeg',
      originalname: 'x.png',
    } as Express.Multer.File;
    expect(resolveSafeImageContentType(file)).toBeNull();
  });
});
