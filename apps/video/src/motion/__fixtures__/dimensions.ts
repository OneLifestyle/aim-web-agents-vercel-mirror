import type { Dimensions } from '../types';

export const HD_16_BY_9_CANVAS: Dimensions = Object.freeze({
  width: 1920,
  height: 1080,
});

export const SOURCE_DIMENSION_FIXTURES = Object.freeze({
  landscape4By3: Object.freeze({ width: 4000, height: 3000 }),
  portrait3By4: Object.freeze({ width: 3000, height: 4000 }),
  square: Object.freeze({ width: 3000, height: 3000 }),
  exact16By9: Object.freeze({ width: 3840, height: 2160 }),
  wide2By1: Object.freeze({ width: 4000, height: 2000 }),
}) satisfies Readonly<Record<string, Dimensions>>;
