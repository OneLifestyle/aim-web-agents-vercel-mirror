import { describe, expect, it } from 'vitest';
import { parseEncodedImageDimensions } from './encodedImageDimensions';

describe('bounded encoded image dimension parsing', () => {
  it('reads PNG IHDR dimensions without decoding pixels', () => {
    const bytes = new Uint8Array(24);
    bytes.set(new TextEncoder().encode('IHDR'), 12);
    new DataView(bytes.buffer).setUint32(16, 1920, false);
    new DataView(bytes.buffer).setUint32(20, 1080, false);
    expect(parseEncodedImageDimensions(bytes, 'png')).toEqual({ width: 1920, height: 1080 });
  });

  it('reads JPEG start-of-frame dimensions', () => {
    const bytes = new Uint8Array([
      0xff, 0xd8,
      0xff, 0xc0, 0x00, 0x11, 0x08,
      0x04, 0x38,
      0x07, 0x80,
      0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
    ]);
    expect(parseEncodedImageDimensions(bytes, 'jpeg')).toEqual({ width: 1920, height: 1080 });
  });

  it('reads WebP VP8X dimensions', () => {
    const bytes = new Uint8Array(30);
    bytes.set(new TextEncoder().encode('RIFF'), 0);
    bytes.set(new TextEncoder().encode('WEBP'), 8);
    bytes.set(new TextEncoder().encode('VP8X'), 12);
    new DataView(bytes.buffer).setUint32(16, 10, true);
    const widthMinusOne = 1919;
    const heightMinusOne = 1079;
    bytes.set([widthMinusOne & 0xff, (widthMinusOne >>> 8) & 0xff, (widthMinusOne >>> 16) & 0xff], 24);
    bytes.set([heightMinusOne & 0xff, (heightMinusOne >>> 8) & 0xff, (heightMinusOne >>> 16) & 0xff], 27);
    expect(parseEncodedImageDimensions(bytes, 'webp')).toEqual({ width: 1920, height: 1080 });
  });
});
