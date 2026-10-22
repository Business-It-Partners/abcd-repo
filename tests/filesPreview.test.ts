import { describe, expect, it } from 'vitest';
import { inspectImageDimensions, MAX_PREVIEW_BYTES } from '../src/filesPreview';

const tinyPng = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFUlEQVR42mP06FnCgA0wMeAAg1MCACmLAYglPyuxAAAAAElFTkSuQmCC',
  'base64',
));

describe('M16 bounded image preview headers', () => {
  it('recognizes a small PNG and reports dimensions without decoding it', () => {
    expect(inspectImageDimensions(tinyPng, '.png')).toEqual({ width: 8, height: 8, mime: 'image/png' });
  });

  it('rejects mismatched extensions, malformed data and oversized payloads', () => {
    expect(inspectImageDimensions(tinyPng, '.pdf')).toBeNull();
    expect(inspectImageDimensions(tinyPng, '.jpg')).toBeNull();
    expect(inspectImageDimensions(new Uint8Array([1, 2, 3]), '.png')).toBeNull();
    expect(inspectImageDimensions(new Uint8Array(MAX_PREVIEW_BYTES + 1), '.png')).toBeNull();
  });

  it('recognizes bounded JPEG frame dimensions', () => {
    const jpeg = Uint8Array.from([0xff,0xd8,0xff,0xc0,0x00,0x11,0x08,0x00,0x01,0x00,0x01,
      0x03,0x01,0x11,0x00,0x02,0x11,0x00,0x03,0x11,0x00,0xff,0xd9]);
    expect(inspectImageDimensions(jpeg, '.jpeg')).toEqual({ width: 1, height: 1, mime: 'image/jpeg' });
  });

  it('rejects extreme dimensions before handing an image to Chromium decode', () => {
    const oversized = Uint8Array.from(tinyPng);
    new DataView(oversized.buffer).setUint32(16, 10_000, false);
    new DataView(oversized.buffer).setUint32(20, 10_000, false);
    expect(inspectImageDimensions(oversized, '.png')).toBeNull();
  });
});
