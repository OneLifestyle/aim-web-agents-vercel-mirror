import type { MotionEasing } from './types';

export function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    throw new RangeError('Progress must be a finite number.');
  }

  return Math.min(1, Math.max(0, progress));
}

/** A deterministic cubic smoothstep used by preview and export. */
export function applyEasing(
  progress: number,
  easing: MotionEasing = 'ease-in-out',
): number {
  const clampedProgress = clampProgress(progress);

  switch (easing) {
    case 'linear':
      return clampedProgress;
    case 'ease-in':
      return clampedProgress ** 3;
    case 'ease-out':
      return 1 - (1 - clampedProgress) ** 3;
    case 'ease-in-out':
      return (
        clampedProgress *
        clampedProgress *
        (3 - 2 * clampedProgress)
      );
    default: {
      const unsupportedEasing: never = easing;
      throw new RangeError(`Unsupported easing: ${String(unsupportedEasing)}`);
    }
  }
}
