/** Bounded raster-image preview helpers for the trusted Dental OS shell UI. */
export type FilePreviewInput = { bytes: Uint8Array; typeHint: string };
export type ImageDimensions = { width: number; height: number; mime: string };

export const MAX_PREVIEW_BYTES = 16 * 1024 * 1024;
const MAX_DIMENSION = 20_000;
const MAX_PIXELS = 25_000_000;
const THUMB_WIDTH = 256;
const THUMB_HEIGHT = 192;

const ascii = (b: Uint8Array, at: number, value: string) =>
  at >= 0 && at + value.length <= b.length && [...value].every((c, i) => b[at + i] === c.charCodeAt(0));
const u16be = (b: Uint8Array, at: number) => at >= 0 && at + 2 <= b.length ? (b[at] << 8) | b[at + 1] : 0;
const u16le = (b: Uint8Array, at: number) => at >= 0 && at + 2 <= b.length ? b[at] | (b[at + 1] << 8) : 0;
const u24le = (b: Uint8Array, at: number) => at >= 0 && at + 3 <= b.length ? b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) : 0;
const u32be = (b: Uint8Array, at: number) => at >= 0 && at + 4 <= b.length ? b[at] * 0x1000000 + (b[at + 1] << 16) + (b[at + 2] << 8) + b[at + 3] : 0;
const u32le = (b: Uint8Array, at: number) => at >= 0 && at + 4 <= b.length ? (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0 : 0;
const i32le = (b: Uint8Array, at: number) => {
  if (at < 0 || at + 4 > b.length) return 0;
  return new DataView(b.buffer, b.byteOffset + at, 4).getInt32(0, true);
};

function jpegDimensions(b: Uint8Array): ImageDimensions | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let at = 2;
  while (at + 4 <= b.length) {
    if (b[at] !== 0xff) { at++; continue; }
    while (at < b.length && b[at] === 0xff) at++;
    if (at >= b.length) return null;
    const marker = b[at++];
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    const length = u16be(b, at);
    if (length < 2 || at + length > b.length) return null;
    const startOfFrame = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
    if (startOfFrame && length >= 7) {
      return { width: u16be(b, at + 5), height: u16be(b, at + 3), mime: 'image/jpeg' };
    }
    at += length;
  }
  return null;
}

function webpDimensions(b: Uint8Array): ImageDimensions | null {
  if (b.length < 25 || !ascii(b, 0, 'RIFF') || !ascii(b, 8, 'WEBP')) return null;
  const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (chunk === 'VP8X' && b.length >= 30) {
    return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1, mime: 'image/webp' };
  }
  if (chunk === 'VP8L' && b.length >= 25 && b[20] === 0x2f) {
    return { width: 1 + b[21] + ((b[22] & 0x3f) << 8), height: 1 + (b[22] >> 6) + (b[23] << 2) + ((b[24] & 0x0f) << 10), mime: 'image/webp' };
  }
  if (chunk === 'VP8 ' && b.length >= 30 && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
    return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff, mime: 'image/webp' };
  }
  return null;
}

export function inspectImageDimensions(bytes: Uint8Array, typeHint: string): ImageDimensions | null {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 12 || bytes.byteLength > MAX_PREVIEW_BYTES) return null;
  let dimensions: ImageDimensions | null = null;
  if (bytes[0] === 0x89 && ascii(bytes, 1, 'PNG\r\n\x1a\n') && ascii(bytes, 12, 'IHDR')) {
    dimensions = { width: u32be(bytes, 16), height: u32be(bytes, 20), mime: 'image/png' };
  } else if (ascii(bytes, 0, 'GIF87a') || ascii(bytes, 0, 'GIF89a')) {
    dimensions = { width: u16le(bytes, 6), height: u16le(bytes, 8), mime: 'image/gif' };
  } else if (ascii(bytes, 0, 'BM') && bytes.length >= 26) {
    const headerSize = u32le(bytes, 14);
    const width = headerSize >= 40 ? i32le(bytes, 18) : u16le(bytes, 18);
    const rawHeight = headerSize >= 40 ? i32le(bytes, 22) : u16le(bytes, 20);
    dimensions = { width: Math.abs(width), height: Math.abs(rawHeight), mime: 'image/bmp' };
  } else {
    dimensions = webpDimensions(bytes) ?? jpegDimensions(bytes);
  }
  const extensions: Record<string, readonly string[]> = {
    'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/webp': ['.webp'],
    'image/gif': ['.gif'], 'image/bmp': ['.bmp'],
  };
  if (!dimensions || !extensions[dimensions.mime]?.includes(typeHint.toLowerCase())) return null;
  const { width, height } = dimensions;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1
    || width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) return null;
  return dimensions;
}

/** Decode in the sandboxed shell renderer and emit only a small, transient preview. */
export async function createLocalThumbnail(input: FilePreviewInput): Promise<Blob | null> {
  const dimensions = inspectImageDimensions(input.bytes, input.typeHint);
  if (!dimensions) return null;
  const scale = Math.min(THUMB_WIDTH / dimensions.width, THUMB_HEIGHT / dimensions.height, 1);
  const resizeWidth = Math.max(1, Math.round(dimensions.width * scale));
  const resizeHeight = Math.max(1, Math.round(dimensions.height * scale));
  let bitmap: ImageBitmap | undefined;
  try {
    const payload = Uint8Array.from(input.bytes);
    bitmap = await createImageBitmap(new Blob([payload], { type: dimensions.mime }), {
      resizeWidth, resizeHeight, resizeQuality: 'high',
    });
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    return blob && blob.size <= 256 * 1024 ? blob : null;
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}
