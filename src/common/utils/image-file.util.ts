/**
 * Shared image upload validation (magic bytes + declared MIME).
 * Does not trust client extension alone.
 */

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export type DetectedImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

/** Detect image type from file magic bytes. */
export function detectImageMimeFromBuffer(
  buffer: Buffer | undefined | null,
): DetectedImageMime | null {
  if (!buffer || buffer.length < 3) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

export function normalizeDeclaredImageMime(mimetype: string): string {
  const lower = (mimetype || '').toLowerCase().trim();
  if (lower === 'image/jpg') return 'image/jpeg';
  return lower;
}

/**
 * Returns a safe content-type for upstream, or null if the file is not a
 * supported image (magic bytes must match an allowed type).
 */
export function resolveSafeImageContentType(
  file: Express.Multer.File,
): DetectedImageMime | null {
  const detected = detectImageMimeFromBuffer(file.buffer);
  if (!detected) return null;

  const declared = normalizeDeclaredImageMime(file.mimetype || '');
  // If client declared a MIME, it must agree with magic bytes (jpg/jpeg both ok).
  if (
    declared &&
    ALLOWED_IMAGE_MIME_TYPES.has(declared) &&
    normalizeDeclaredImageMime(declared) !== detected
  ) {
    return null;
  }

  return detected;
}

export function isAllowedImageUpload(file: Express.Multer.File): boolean {
  return resolveSafeImageContentType(file) != null;
}
