import type { DecodedImageDimensions } from './intake';
import type { SupportedImageFormat } from './signatures';

const MAX_HEADER_BYTES = 512 * 1024;

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...bytes.slice(start, end));

const uint16BigEndian = (bytes: Uint8Array, offset: number) =>
  (bytes[offset]! << 8) | bytes[offset + 1]!;

const uint24LittleEndian = (bytes: Uint8Array, offset: number) =>
  bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);

const uint32BigEndian = (bytes: Uint8Array, offset: number) =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, false);

const uint32LittleEndian = (bytes: Uint8Array, offset: number) =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);

export const parseEncodedImageDimensions = (
  bytes: Uint8Array,
  format: SupportedImageFormat,
): DecodedImageDimensions | null => {
  if (format === 'png') {
    if (bytes.length < 24 || ascii(bytes, 12, 16) !== 'IHDR') return null;
    return {
      width: uint32BigEndian(bytes, 16),
      height: uint32BigEndian(bytes, 20),
    };
  }

  if (format === 'jpeg') {
    const startOfFrameMarkers = new Set([
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
      0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
    ]);
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      while (bytes[offset] === 0xff) offset += 1;
      const marker = bytes[offset]!;
      const markerStart = offset - 1;
      if (startOfFrameMarkers.has(marker)) {
        return {
          height: uint16BigEndian(bytes, markerStart + 5),
          width: uint16BigEndian(bytes, markerStart + 7),
        };
      }
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 1;
        continue;
      }
      if (markerStart + 4 > bytes.length) return null;
      const segmentLength = uint16BigEndian(bytes, markerStart + 2);
      if (segmentLength < 2) return null;
      offset = markerStart + 2 + segmentLength;
    }
    return null;
  }

  if (bytes.length < 30 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 12) !== 'WEBP') {
    return null;
  }
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkType = ascii(bytes, offset, offset + 4);
    const chunkSize = uint32LittleEndian(bytes, offset + 4);
    const dataOffset = offset + 8;
    if (chunkType === 'VP8X' && dataOffset + 10 <= bytes.length) {
      return {
        width: uint24LittleEndian(bytes, dataOffset + 4) + 1,
        height: uint24LittleEndian(bytes, dataOffset + 7) + 1,
      };
    }
    if (
      chunkType === 'VP8 '
      && dataOffset + 10 <= bytes.length
      && bytes[dataOffset + 3] === 0x9d
      && bytes[dataOffset + 4] === 0x01
      && bytes[dataOffset + 5] === 0x2a
    ) {
      return {
        width: uint16BigEndian(new Uint8Array([bytes[dataOffset + 7]!, bytes[dataOffset + 6]!]), 0) & 0x3fff,
        height: uint16BigEndian(new Uint8Array([bytes[dataOffset + 9]!, bytes[dataOffset + 8]!]), 0) & 0x3fff,
      };
    }
    if (chunkType === 'VP8L' && dataOffset + 5 <= bytes.length && bytes[dataOffset] === 0x2f) {
      const bits = uint32LittleEndian(bytes, dataOffset + 1);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
      };
    }
    offset = dataOffset + chunkSize + (chunkSize % 2);
  }
  return null;
};

export const readEncodedImageDimensions = async (
  blob: Blob,
  format: SupportedImageFormat,
) => parseEncodedImageDimensions(
  new Uint8Array(await blob.slice(0, MAX_HEADER_BYTES).arrayBuffer()),
  format,
);
