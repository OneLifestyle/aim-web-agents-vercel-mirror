import { describe, expect, it } from 'vitest';

import {
  applyEasing,
  createCoverCrop,
  createImagePixelPlacement,
  createMotionPresetCrops,
  evaluatePairDissolveFrame,
  evaluateShotFrame,
  evaluateSingleImageFrame,
  interpolateNormalizedCrop,
} from '..';
import {
  HD_16_BY_9_CANVAS,
  SOURCE_DIMENSION_FIXTURES,
} from '../__fixtures__/dimensions';
import type { Dimensions, NormalizedCropRect } from '../types';

function expectCropWithinSource(crop: NormalizedCropRect): void {
  expect(crop.x).toBeGreaterThanOrEqual(0);
  expect(crop.y).toBeGreaterThanOrEqual(0);
  expect(crop.width).toBeGreaterThan(0);
  expect(crop.height).toBeGreaterThan(0);
  expect(crop.x + crop.width).toBeLessThanOrEqual(1);
  expect(crop.y + crop.height).toBeLessThanOrEqual(1);
}

function expectCropAspect(
  crop: NormalizedCropRect,
  source: Dimensions,
): void {
  const cropAspect =
    (crop.width * source.width) / (crop.height * source.height);
  expect(cropAspect).toBeCloseTo(
    HD_16_BY_9_CANVAS.width / HD_16_BY_9_CANVAS.height,
    10,
  );
}

function expectNoExposedEdges(
  crop: NormalizedCropRect,
  source: Dimensions,
): void {
  const placement = createImagePixelPlacement(
    crop,
    source,
    HD_16_BY_9_CANVAS,
  );
  const rightEdge = placement.fullImageRect.x + placement.fullImageRect.width;
  const bottomEdge = placement.fullImageRect.y + placement.fullImageRect.height;

  expect(placement.fullImageRect.x).toBeLessThanOrEqual(0);
  expect(placement.fullImageRect.y).toBeLessThanOrEqual(0);
  expect(rightEdge).toBeGreaterThanOrEqual(HD_16_BY_9_CANVAS.width);
  expect(bottomEdge).toBeGreaterThanOrEqual(HD_16_BY_9_CANVAS.height);
}

describe('source-aware cover crops', () => {
  it.each(Object.entries(SOURCE_DIMENSION_FIXTURES))(
    'covers 16:9 from %s source pixels without stretching',
    (_name, source) => {
      const crop = createCoverCrop(source, HD_16_BY_9_CANVAS);

      expectCropWithinSource(crop);
      expectCropAspect(crop, source);
      expectNoExposedEdges(crop, source);
    },
  );

  it('produces the expected portrait, landscape, square and exact crops', () => {
    expect(
      createCoverCrop(
        SOURCE_DIMENSION_FIXTURES.landscape4By3,
        HD_16_BY_9_CANVAS,
      ),
    ).toEqual({ x: 0, y: 0.125, width: 1, height: 0.75 });
    expect(
      createCoverCrop(
        SOURCE_DIMENSION_FIXTURES.portrait3By4,
        HD_16_BY_9_CANVAS,
      ),
    ).toEqual({ x: 0, y: 0.2890625, width: 1, height: 0.421875 });
    expect(
      createCoverCrop(SOURCE_DIMENSION_FIXTURES.square, HD_16_BY_9_CANVAS),
    ).toEqual({ x: 0, y: 0.21875, width: 1, height: 0.5625 });
    expect(
      createCoverCrop(
        SOURCE_DIMENSION_FIXTURES.exact16By9,
        HD_16_BY_9_CANVAS,
      ),
    ).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it('rejects invalid decoded dimensions', () => {
    expect(() =>
      createCoverCrop({ width: 0, height: 1000 }, HD_16_BY_9_CANVAS),
    ).toThrow(/positive finite/);
    expect(() =>
      createCoverCrop({ width: Number.NaN, height: 1000 }, HD_16_BY_9_CANVAS),
    ).toThrow(/positive finite/);
  });
});

describe('motion preset endpoints and interpolation', () => {
  const presets = [
    'still',
    'zoom-in',
    'zoom-out',
    'pan-left',
    'pan-right',
  ] as const;

  it.each(Object.entries(SOURCE_DIMENSION_FIXTURES))(
    'keeps every preset crop valid for %s',
    (_name, source) => {
      for (const preset of presets) {
        const crops = createMotionPresetCrops(
          preset,
          source,
          HD_16_BY_9_CANVAS,
        );

        for (const crop of [
          crops.start,
          interpolateNormalizedCrop(crops.start, crops.end, 0.5),
          crops.end,
        ]) {
          expectCropWithinSource(crop);
          expectCropAspect(crop, source);
          expectNoExposedEdges(crop, source);
        }
      }
    },
  );

  it('returns exact start, midpoint and end crops', () => {
    const start = { x: 0, y: 0.2, width: 1, height: 0.6 };
    const end = { x: 0.1, y: 0.26, width: 0.8, height: 0.48 };

    expect(interpolateNormalizedCrop(start, end, 0)).toEqual(start);
    expect(interpolateNormalizedCrop(start, end, 0.5)).toEqual({
      x: 0.05,
      y: 0.23,
      width: 0.9,
      height: 0.54,
    });
    expect(interpolateNormalizedCrop(start, end, 1)).toEqual(end);
  });

  it('uses correct visual zoom labels', () => {
    const source = SOURCE_DIMENSION_FIXTURES.exact16By9;
    const zoomIn = createMotionPresetCrops(
      'zoom-in',
      source,
      HD_16_BY_9_CANVAS,
    );
    const zoomOut = createMotionPresetCrops(
      'zoom-out',
      source,
      HD_16_BY_9_CANVAS,
    );

    expect(zoomIn.end.width).toBeLessThan(zoomIn.start.width);
    expect(zoomOut.end.width).toBeGreaterThan(zoomOut.start.width);
    expect(
      createImagePixelPlacement(zoomIn.end, source, HD_16_BY_9_CANVAS)
        .scale,
    ).toBeGreaterThan(
      createImagePixelPlacement(zoomIn.start, source, HD_16_BY_9_CANVAS)
        .scale,
    );
  });

  it('moves source pixels left and right without exposing an edge', () => {
    const source = SOURCE_DIMENSION_FIXTURES.exact16By9;
    const panLeft = createMotionPresetCrops(
      'pan-left',
      source,
      HD_16_BY_9_CANVAS,
    );
    const panRight = createMotionPresetCrops(
      'pan-right',
      source,
      HD_16_BY_9_CANVAS,
    );
    const leftStartPlacement = createImagePixelPlacement(
      panLeft.start,
      source,
      HD_16_BY_9_CANVAS,
    );
    const leftEndPlacement = createImagePixelPlacement(
      panLeft.end,
      source,
      HD_16_BY_9_CANVAS,
    );

    expect(panLeft.end.x).toBeGreaterThan(panLeft.start.x);
    expect(leftEndPlacement.fullImageRect.x).toBeLessThan(
      leftStartPlacement.fullImageRect.x,
    );
    expect(panRight.end.x).toBeLessThan(panRight.start.x);
    expectNoExposedEdges(panLeft.start, source);
    expectNoExposedEdges(panLeft.end, source);
    expectNoExposedEdges(panRight.start, source);
    expectNoExposedEdges(panRight.end, source);
  });
});

describe('renderer-neutral frame evaluation', () => {
  it('applies ease-in-out rather than ignoring it', () => {
    expect(applyEasing(0.25, 'linear')).toBe(0.25);
    expect(applyEasing(0.25, 'ease-in-out')).toBe(0.15625);

    const request = {
      sourceMode: 'single' as const,
      sourceDimensions: SOURCE_DIMENSION_FIXTURES.exact16By9,
      canvasDimensions: HD_16_BY_9_CANVAS,
      motionPreset: 'zoom-in' as const,
      progress: 0.25,
    };
    const linear = evaluateSingleImageFrame({ ...request, easing: 'linear' });
    const eased = evaluateSingleImageFrame({
      ...request,
      easing: 'ease-in-out',
    });

    expect(eased.linearProgress).toBe(0.25);
    expect(eased.easedProgress).toBe(0.15625);
    expect(eased.crop.width).toBeGreaterThan(linear.crop.width);
  });

  it('applies explicit ease-in and ease-out curves', () => {
    expect(applyEasing(0.5, 'ease-in')).toBe(0.125);
    expect(applyEasing(0.5, 'ease-out')).toBe(0.875);
  });

  it('evaluates exact time and exact progress identically', () => {
    const baseRequest = {
      sourceMode: 'single' as const,
      sourceDimensions: SOURCE_DIMENSION_FIXTURES.landscape4By3,
      canvasDimensions: HD_16_BY_9_CANVAS,
      motionPreset: 'pan-left' as const,
      easing: 'ease-in-out' as const,
    };
    const atTime = evaluateShotFrame({
      ...baseRequest,
      timeSeconds: 1.25,
      durationSeconds: 5,
    });
    const atProgress = evaluateShotFrame({ ...baseRequest, progress: 0.25 });

    expect(atTime).toEqual(atProgress);
  });

  it('clamps preview seeks before the start and after the end', () => {
    const baseRequest = {
      sourceMode: 'single' as const,
      sourceDimensions: SOURCE_DIMENSION_FIXTURES.exact16By9,
      canvasDimensions: HD_16_BY_9_CANVAS,
      motionPreset: 'zoom-in' as const,
      easing: 'linear' as const,
      durationSeconds: 4,
    };
    const before = evaluateSingleImageFrame({
      ...baseRequest,
      timeSeconds: -1,
    });
    const after = evaluateSingleImageFrame({
      ...baseRequest,
      timeSeconds: 8,
    });

    expect(before.linearProgress).toBe(0);
    expect(after.linearProgress).toBe(1);
  });

  it('rejects a custom crop that would stretch the source', () => {
    expect(() =>
      evaluateSingleImageFrame({
        sourceMode: 'single',
        sourceDimensions: SOURCE_DIMENSION_FIXTURES.square,
        canvasDimensions: HD_16_BY_9_CANVAS,
        motionPreset: 'still',
        progress: 0,
        cropEndpoints: {
          start: { x: 0, y: 0, width: 1, height: 1 },
          end: { x: 0, y: 0, width: 1, height: 1 },
        },
      }),
    ).toThrow(/pixel aspect/);
  });
});

describe('pair dissolve', () => {
  it('cross-dissolves two independently covered real images', () => {
    const start = evaluatePairDissolveFrame({
      sourceMode: 'pair',
      pairTreatment: 'dissolve',
      startSourceDimensions: SOURCE_DIMENSION_FIXTURES.portrait3By4,
      endSourceDimensions: SOURCE_DIMENSION_FIXTURES.wide2By1,
      canvasDimensions: HD_16_BY_9_CANVAS,
      progress: 0,
      easing: 'linear',
    });
    const middle = evaluatePairDissolveFrame({
      sourceMode: 'pair',
      pairTreatment: 'dissolve',
      startSourceDimensions: SOURCE_DIMENSION_FIXTURES.portrait3By4,
      endSourceDimensions: SOURCE_DIMENSION_FIXTURES.wide2By1,
      canvasDimensions: HD_16_BY_9_CANVAS,
      progress: 0.5,
      easing: 'linear',
    });
    const end = evaluatePairDissolveFrame({
      sourceMode: 'pair',
      pairTreatment: 'dissolve',
      startSourceDimensions: SOURCE_DIMENSION_FIXTURES.portrait3By4,
      endSourceDimensions: SOURCE_DIMENSION_FIXTURES.wide2By1,
      canvasDimensions: HD_16_BY_9_CANVAS,
      progress: 1,
      easing: 'linear',
    });

    expect(start.layers.map((layer) => layer.opacity)).toEqual([1, 0]);
    expect(middle.layers.map((layer) => layer.opacity)).toEqual([0.5, 0.5]);
    expect(end.layers.map((layer) => layer.opacity)).toEqual([0, 1]);
    expect(middle.layers[0].opacity + middle.layers[1].opacity).toBe(1);
    expectCropAspect(
      middle.layers[0].crop,
      SOURCE_DIMENSION_FIXTURES.portrait3By4,
    );
    expectCropAspect(
      middle.layers[1].crop,
      SOURCE_DIMENSION_FIXTURES.wide2By1,
    );
    expectNoExposedEdges(
      middle.layers[0].crop,
      SOURCE_DIMENSION_FIXTURES.portrait3By4,
    );
    expectNoExposedEdges(
      middle.layers[1].crop,
      SOURCE_DIMENSION_FIXTURES.wide2By1,
    );
  });

  it('applies dissolve easing deterministically', () => {
    const frame = evaluatePairDissolveFrame({
      sourceMode: 'pair',
      pairTreatment: 'dissolve',
      startSourceDimensions: SOURCE_DIMENSION_FIXTURES.square,
      endSourceDimensions: SOURCE_DIMENSION_FIXTURES.exact16By9,
      canvasDimensions: HD_16_BY_9_CANVAS,
      progress: 0.25,
      easing: 'ease-in-out',
    });

    expect(frame.layers[0].opacity).toBe(0.84375);
    expect(frame.layers[1].opacity).toBe(0.15625);
  });
});
