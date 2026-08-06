import type { RenderError } from '../project/schemas';

export class RenderCancelledError extends Error {
  constructor() {
    super('Video export was cancelled. No partial output was kept.');
    this.name = 'RenderCancelledError';
  }
}

export class RenderCapabilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RenderCapabilityError';
  }
}

export const createControlledRenderError = (
  error: unknown,
  occurredAt = new Date().toISOString(),
): RenderError => {
  const message = error instanceof Error ? error.message : 'The local video export failed.';
  const code: RenderError['code'] = error instanceof RenderCancelledError
    ? 'cancelled'
    : error instanceof RenderCapabilityError
      ? 'unsupported'
      : /missing|no longer available/i.test(message)
        ? 'missing-asset'
        : /decode|corrupt|could not be prepared/i.test(message)
          ? 'decode-failed'
          : /validation|requires 15 to 30|rights metadata/i.test(message)
            ? 'validation-failed'
            : 'encode-failed';
  return {
    code,
    message,
    retriable: code !== 'cancelled' && code !== 'unsupported',
    occurredAt,
  };
};
