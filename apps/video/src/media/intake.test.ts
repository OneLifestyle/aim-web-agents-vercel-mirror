import { describe, expect, it } from 'vitest';
import { normalizeBlobMime } from '../persistence/localProjectRepository';
import { IMAGE_FILE_LIMITS } from './limits';
import { validateAudioFile, validateImageBatch } from './intake';

const pngFile = (name = 'property.png', tail = 1) => new File([
  new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    tail, 0, 0, 0, 0, 0, 0, 0,
  ]),
], name, { type: 'text/plain' });

const wavFile = (name = 'music.wav') => new File([
  new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0,
    0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20,
  ]),
], name, { type: 'application/octet-stream' });

const validDimensions = async () => ({ width: 1920, height: 1080 });

describe('local image intake', () => {
  it('uses actual signatures and decoded dimensions rather than browser MIME', async () => {
    const result = await validateImageBatch([pngFile()], {
      decodeDimensions: validDimensions,
    });
    expect(result.accepted[0]).toMatchObject({
      detectedFormat: 'png',
      detectedMimeType: 'image/png',
      width: 1920,
      height: 1080,
    });
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'TOO_FEW_PHOTOS' }));
    const accepted = result.accepted[0]!;
    const normalized = normalizeBlobMime(accepted.file, accepted.detectedMimeType);
    expect(normalized.type).toBe('image/png');
    expect(normalized.size).toBe(accepted.file.size);
    expect(new Uint8Array(await normalized.arrayBuffer())).toEqual(
      new Uint8Array(await accepted.file.arrayBuffer()),
    );
  });

  it('rejects zero-byte, spoofed-signature and corrupt files with named errors', async () => {
    const zero = new File([], 'zero.png', { type: 'image/png' });
    const spoofed = new File(['not an image'], 'spoofed.png', { type: 'image/png' });
    const corrupt = pngFile('corrupt.png');
    const result = await validateImageBatch([zero, spoofed, corrupt], {
      decodeDimensions: async (blob) => {
        if (blob === corrupt) throw new Error('synthetic decode failure');
        return { width: 1920, height: 1080 };
      },
    });
    expect(result.accepted).toHaveLength(0);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'ZERO_BYTE_FILE', filename: 'zero.png' }),
      expect.objectContaining({ code: 'UNSUPPORTED_SIGNATURE', filename: 'spoofed.png' }),
      expect.objectContaining({ code: 'CORRUPT_FILE', filename: 'corrupt.png' }),
    ]));
  });

  it('rejects duplicate bytes, count overflow and total-size overflow on replacement', async () => {
    const duplicateResult = await validateImageBatch([
      pngFile('first.png'),
      pngFile('duplicate.png'),
    ], { decodeDimensions: validDimensions });
    expect(duplicateResult.accepted).toHaveLength(1);
    expect(duplicateResult.issues).toContainEqual(expect.objectContaining({ code: 'DUPLICATE_FILE' }));

    const countResult = await validateImageBatch([pngFile()], {
      currentImageCount: IMAGE_FILE_LIMITS.maximumProjectCount,
      decodeDimensions: validDimensions,
    });
    expect(countResult.issues[0]?.code).toBe('TOO_MANY_PHOTOS');

    const totalResult = await validateImageBatch([pngFile()], {
      mode: 'replacement',
      currentTotalBytes: IMAGE_FILE_LIMITS.maximumTotalBytes - 1,
      decodeDimensions: validDimensions,
    });
    expect(totalResult.issues[0]?.code).toBe('TOTAL_TOO_LARGE');
  });

  it('rejects decoded images outside minimum and maximum pixel bounds', async () => {
    const tooSmall = await validateImageBatch([pngFile()], {
      decodeDimensions: async () => ({ width: 639, height: 360 }),
    });
    expect(tooSmall.issues[0]?.code).toBe('DIMENSIONS_TOO_SMALL');

    const tooLarge = await validateImageBatch([pngFile('large.png', 2)], {
      decodeDimensions: async () => ({ width: 16_001, height: 5_000 }),
    });
    expect(tooLarge.issues[0]?.code).toBe('DIMENSIONS_TOO_LARGE');
  });
});

describe('local audio intake', () => {
  it('signature-checks and decodes a supported local track', async () => {
    const result = await validateAudioFile(wavFile(), { decodeDuration: async () => 12.5 });
    expect(result.accepted).toMatchObject({
      detectedFormat: 'wav',
      detectedMimeType: 'audio/wav',
      durationSec: 12.5,
    });
  });

  it('rejects an unsupported signature and overlong decoded duration', async () => {
    const unsupported = await validateAudioFile(
      new File(['not audio'], 'music.wav', { type: 'audio/wav' }),
      { decodeDuration: async () => 1 },
    );
    expect(unsupported.issues[0]?.code).toBe('UNSUPPORTED_SIGNATURE');

    const tooLong = await validateAudioFile(wavFile(), {
      decodeDuration: async () => 30 * 60 + 0.1,
    });
    expect(tooLong.issues[0]?.code).toBe('AUDIO_TOO_LONG');
  });
});
