import { describe, expect, it } from 'vitest';
import {
  createControlledRenderError,
  RenderCancelledError,
  RenderCapabilityError,
} from './renderErrors';

const NOW = '2026-08-06T00:00:00.000Z';

describe('controlled render errors', () => {
  it.each([
    [new RenderCancelledError(), 'cancelled', false],
    [new RenderCapabilityError('WebCodecs are unsupported.'), 'unsupported', false],
    [new Error('A referenced local image is missing.'), 'missing-asset', true],
    [new Error('The image could not be decoded because it is corrupt.'), 'decode-failed', true],
    [new Error('A complete export requires 15 to 30 photographs.'), 'validation-failed', true],
    [new Error('The encoder stopped unexpectedly.'), 'encode-failed', true],
  ])('classifies %s as %s', (error, code, retriable) => {
    expect(createControlledRenderError(error, NOW)).toMatchObject({
      code,
      retriable,
      occurredAt: NOW,
    });
  });
});
