import { describe, expect, it } from 'vitest';
import { detectAudioSignature, detectImageSignature } from './signatures';

describe('media signatures', () => {
  it('recognises JPEG, PNG and WebP by bytes rather than MIME labels', () => {
    expect(detectImageSignature(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
    expect(detectImageSignature(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png');
    expect(detectImageSignature(new TextEncoder().encode('RIFF0000WEBP'))).toBe('webp');
    expect(detectImageSignature(new TextEncoder().encode('not-an-image'))).toBeNull();
  });

  it('recognises WAV, MP3 and M4A signatures', () => {
    expect(detectAudioSignature(new TextEncoder().encode('RIFF0000WAVE'))).toBe('wav');
    expect(detectAudioSignature(new TextEncoder().encode('ID3example'))).toBe('mp3');
    expect(detectAudioSignature(new Uint8Array([0xff, 0xfb, 0x90, 0x64]))).toBe('mp3');
    expect(detectAudioSignature(new Uint8Array([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20]))).toBe('m4a');
    expect(detectAudioSignature(new Uint8Array([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]))).toBeNull();
  });
});
