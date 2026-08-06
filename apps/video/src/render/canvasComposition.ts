import { evaluatePairDissolveFrame, evaluateSingleImageFrame } from '../motion';
import type { MediaAsset, Overlay, VideoProject, VideoShot } from '../project/schemas';

export type CanvasImageMap = ReadonlyMap<string, CanvasImageSource>;

export interface TimelineShotSegment {
  shot: VideoShot;
  startTimeSec: number;
  endTimeSec: number;
}

export interface ProjectFramePosition {
  kind: 'shot' | 'end-card' | 'empty';
  timeSec: number;
  totalDurationSec: number;
  shotSegment?: TimelineShotSegment;
}

export const getOrderedShots = (project: VideoProject) => {
  const shotsById = new Map(project.shots.map((shot) => [shot.id, shot]));
  return project.orderedShotIds.map((id) => shotsById.get(id)).filter((shot): shot is VideoShot => Boolean(shot));
};

export const getShotSegments = (project: VideoProject): TimelineShotSegment[] => {
  let cursor = 0;
  return getOrderedShots(project).map((shot) => {
    const segment = { shot, startTimeSec: cursor, endTimeSec: cursor + shot.durationSec };
    cursor = segment.endTimeSec;
    return segment;
  });
};

export const getShotsDuration = (project: VideoProject) =>
  getOrderedShots(project).reduce((duration, shot) => duration + shot.durationSec, 0);

export const getProjectDuration = (project: VideoProject) =>
  getShotsDuration(project) + (project.endCard.enabled ? project.endCard.durationSec : 0);

export const resolveProjectFrame = (project: VideoProject, timeSec: number): ProjectFramePosition => {
  const totalDurationSec = getProjectDuration(project);
  const boundedTime = Math.max(0, Math.min(timeSec, Math.max(0, totalDurationSec - Number.EPSILON)));
  const shotSegment = getShotSegments(project).find((segment) => (
    boundedTime >= segment.startTimeSec && boundedTime < segment.endTimeSec
  ));
  if (shotSegment) return { kind: 'shot', timeSec: boundedTime, totalDurationSec, shotSegment };
  if (project.endCard.enabled && boundedTime >= getShotsDuration(project)) {
    return { kind: 'end-card', timeSec: boundedTime, totalDurationSec };
  }
  return { kind: 'empty', timeSec: boundedTime, totalDurationSec };
};

const requireAsset = (project: VideoProject, assetId: string) => {
  const asset = project.mediaAssets.find((candidate) => candidate.id === assetId);
  if (!asset) throw new Error(`Project media ${assetId} is missing from the manifest.`);
  return asset;
};

const requireImage = (images: CanvasImageMap, assetId: string) => {
  const image = images.get(assetId);
  if (!image) throw new Error(`Local image ${assetId} is missing or could not be decoded.`);
  return image;
};

const assetDimensions = (asset: MediaAsset) => {
  if (!asset.decodedWidth || !asset.decodedHeight) {
    throw new Error(`Decoded dimensions are missing for ${asset.fileName}.`);
  }
  return { width: asset.decodedWidth, height: asset.decodedHeight };
};

const drawPlacement = (
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  image: CanvasImageSource,
  sourceRect: { x: number; y: number; width: number; height: number },
  width: number,
  height: number,
) => {
  context.drawImage(
    image,
    sourceRect.x,
    sourceRect.y,
    sourceRect.width,
    sourceRect.height,
    0,
    0,
    width,
    height,
  );
};

const roundRect = (
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
};

const drawTitleOverlay = (
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  project: VideoProject,
  overlays: readonly Overlay[],
) => {
  const title = overlays.find((overlay) => overlay.kind === 'title')?.text?.trim();
  const subtitle = overlays.find((overlay) => overlay.kind === 'subtitle')?.text?.trim();
  if (!title && !subtitle) return;
  const { width, height } = project.canvas;
  const x = width * 0.055;
  const bottom = height * 0.89;
  const maxWidth = width * 0.73;
  const titleSize = Math.round(height * 0.047);
  const subtitleSize = Math.round(height * 0.026);
  const titleHeight = title ? titleSize * 1.22 : 0;
  const subtitleHeight = subtitle ? subtitleSize * 1.35 : 0;
  const boxHeight = titleHeight + subtitleHeight + height * 0.045;

  context.save();
  context.fillStyle = 'rgba(8, 17, 29, 0.76)';
  roundRect(context, x - 24, bottom - boxHeight, maxWidth + 48, boxHeight, 18);
  context.fill();
  context.fillStyle = '#ffffff';
  context.textBaseline = 'alphabetic';
  context.textAlign = 'left';
  if (title) {
    context.font = `650 ${titleSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    context.fillText(title, x, bottom - subtitleHeight - height * 0.019, maxWidth);
  }
  if (subtitle) {
    context.fillStyle = 'rgba(255, 255, 255, 0.82)';
    context.font = `500 ${subtitleSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    context.fillText(subtitle, x, bottom - height * 0.018, maxWidth);
  }
  context.restore();
};

const drawWatermark = (
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  project: VideoProject,
  overlays: readonly Overlay[],
  images: CanvasImageMap,
) => {
  if (project.outputVariant !== 'branded') return;
  const watermark = overlays.find((overlay) => overlay.kind === 'watermark' && overlay.assetId);
  if (!watermark?.assetId) return;
  const image = images.get(watermark.assetId);
  if (!image) return;
  const asset = requireAsset(project, watermark.assetId);
  const source = assetDimensions(asset);
  const width = project.canvas.width * 0.12;
  const height = width * (source.height / source.width);
  const margin = project.canvas.width * 0.035;
  context.save();
  context.globalAlpha = watermark.opacity ?? 0.68;
  context.drawImage(image, project.canvas.width - width - margin, margin, width, height);
  context.restore();
};

const activeOverlaysAt = (project: VideoProject, timeSec: number) => project.overlays.filter((overlay) => (
  timeSec >= overlay.timing.startTimeSec
  && timeSec < overlay.timing.startTimeSec + overlay.timing.durationSec
));

const drawEndCard = (
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  project: VideoProject,
  images: CanvasImageMap,
) => {
  const { width, height } = project.canvas;
  const branded = project.outputVariant === 'branded';
  const card = project.endCard;
  context.fillStyle = branded ? (card.backgroundColor ?? '#132133') : '#132133';
  context.fillRect(0, 0, width, height);

  const centerX = width / 2;
  let y = height * 0.28;
  if (branded && card.logoAssetId) {
    const logo = images.get(card.logoAssetId);
    const asset = project.mediaAssets.find((candidate) => candidate.id === card.logoAssetId);
    if (logo && asset?.decodedWidth && asset.decodedHeight) {
      const logoWidth = Math.min(width * 0.22, 420);
      const logoHeight = logoWidth * (asset.decodedHeight / asset.decodedWidth);
      context.drawImage(logo, centerX - logoWidth / 2, y - logoHeight / 2, logoWidth, logoHeight);
      y += logoHeight * 0.75 + height * 0.07;
    }
  }

  context.textAlign = 'center';
  context.fillStyle = card.textColor ?? '#ffffff';
  context.font = `650 ${Math.round(height * 0.058)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  context.fillText(card.title?.trim() || project.videoTitle?.trim() || 'Property presentation', centerX, y, width * 0.78);
  y += height * 0.076;
  const subtitle = card.subtitle?.trim() || project.propertyAddress?.trim();
  if (subtitle) {
    context.fillStyle = branded ? (card.textColor ?? '#ffffff') : 'rgba(255, 255, 255, 0.78)';
    context.font = `450 ${Math.round(height * 0.029)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    context.fillText(subtitle, centerX, y, width * 0.72);
    y += height * 0.095;
  }

  if (branded) {
    const identity = [card.agentName, card.agencyName].filter(Boolean).join(' · ');
    const contact = [card.phone, card.email].filter(Boolean).join('   ');
    context.fillStyle = card.textColor ?? '#ffffff';
    context.font = `600 ${Math.round(height * 0.027)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    if (identity) context.fillText(identity, centerX, y, width * 0.74);
    if (contact) {
      context.fillStyle = 'rgba(255, 255, 255, 0.72)';
      context.font = `450 ${Math.round(height * 0.023)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      context.fillText(contact, centerX, y + height * 0.052, width * 0.74);
    }
  } else {
    context.fillStyle = 'rgba(255, 255, 255, 0.68)';
    context.font = `450 ${Math.round(height * 0.024)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    context.fillText('End of property presentation', centerX, y, width * 0.7);
  }
};

export const drawProjectFrame = (
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  project: VideoProject,
  images: CanvasImageMap,
  timeSec: number,
) => {
  const position = resolveProjectFrame(project, timeSec);
  const { width, height } = project.canvas;
  context.save();
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#0d1119';
  context.fillRect(0, 0, width, height);

  if (position.kind === 'shot' && position.shotSegment) {
    const { shot, startTimeSec } = position.shotSegment;
    const localTimeSec = position.timeSec - startTimeSec;
    if (shot.sourceMode === 'single') {
      const asset = requireAsset(project, shot.startAssetId);
      const frame = evaluateSingleImageFrame({
        sourceMode: 'single',
        sourceDimensions: assetDimensions(asset),
        canvasDimensions: project.canvas,
        motionPreset: shot.motionPreset,
        cropEndpoints: { start: shot.startCrop, end: shot.endCrop },
        easing: shot.easing,
        timeSeconds: localTimeSec,
        durationSeconds: shot.durationSec,
      });
      drawPlacement(context, requireImage(images, asset.id), frame.placement.sourceRect, width, height);
    } else {
      const startAsset = requireAsset(project, shot.startAssetId);
      const endAsset = requireAsset(project, shot.endAssetId);
      const frame = evaluatePairDissolveFrame({
        sourceMode: 'pair',
        pairTreatment: shot.pairTreatment,
        startSourceDimensions: assetDimensions(startAsset),
        endSourceDimensions: assetDimensions(endAsset),
        canvasDimensions: project.canvas,
        startImageCrop: shot.startCrop,
        endImageCrop: shot.endCrop,
        easing: shot.easing,
        timeSeconds: localTimeSec,
        durationSeconds: shot.durationSec,
      });
      for (const layer of frame.layers) {
        context.save();
        context.globalAlpha = layer.opacity;
        const assetId = layer.role === 'start' ? startAsset.id : endAsset.id;
        drawPlacement(context, requireImage(images, assetId), layer.placement.sourceRect, width, height);
        context.restore();
      }
    }

    const overlays = activeOverlaysAt(project, position.timeSec);
    drawTitleOverlay(context, project, overlays);
    drawWatermark(context, project, overlays, images);
  } else if (position.kind === 'end-card') {
    drawEndCard(context, project, images);
  }
  context.restore();
  return position;
};
