export type SupportedImageFormat = 'jpeg' | 'png' | 'webp';
export type SupportedAudioFormat = 'wav' | 'mp3' | 'm4a';

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) =>
  signature.every((value, index) => bytes[offset + index] === value);

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...bytes.slice(start, end));

export const detectImageSignature = (bytes: Uint8Array): SupportedImageFormat | null => {
  if (bytes.length >= 3 && startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (bytes.length >= 8 && startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'png';
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') {
    return 'webp';
  }
  return null;
};

export const detectAudioSignature = (bytes: Uint8Array): SupportedAudioFormat | null => {
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WAVE') {
    return 'wav';
  }
  if (bytes.length >= 3 && ascii(bytes, 0, 3) === 'ID3') return 'mp3';
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return 'mp3';
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === 'ftyp') {
    const audioBrands = new Set(['M4A ', 'M4B ', 'M4P ']);
    for (let offset = 8; offset + 4 <= bytes.length; offset += 4) {
      if (audioBrands.has(ascii(bytes, offset, offset + 4))) return 'm4a';
    }
  }
  return null;
};

export const imageMimeForFormat = (format: SupportedImageFormat) => {
  if (format === 'jpeg') return 'image/jpeg';
  if (format === 'png') return 'image/png';
  return 'image/webp';
};

export const audioMimeForFormat = (format: SupportedAudioFormat) => {
  if (format === 'wav') return 'audio/wav';
  if (format === 'mp3') return 'audio/mpeg';
  return 'audio/mp4';
};
