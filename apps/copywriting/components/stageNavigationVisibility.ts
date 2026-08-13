export type StageRevealGeometry = {
  activeStart: number;
  activeWidth: number;
  contentWidth: number;
  edgePadding: number;
  scrollLeft: number;
  viewportWidth: number;
};

const clamp = (value: number, minimum: number, maximum: number): number => (
  Math.min(Math.max(value, minimum), maximum)
);

/** Returns a centred horizontal scroll position when the active stage is outside the visible strip. */
export const getStageRevealScrollLeft = ({
  activeStart,
  activeWidth,
  contentWidth,
  edgePadding,
  scrollLeft,
  viewportWidth,
}: StageRevealGeometry): number | null => {
  if (viewportWidth <= 0 || contentWidth <= viewportWidth) return null;

  const maximumScrollLeft = Math.max(0, contentWidth - viewportWidth);
  const currentScrollLeft = clamp(scrollLeft, 0, maximumScrollLeft);
  const padding = clamp(edgePadding, 0, viewportWidth / 2);
  const activeEnd = activeStart + activeWidth;
  const visibleStart = currentScrollLeft + padding;
  const visibleEnd = currentScrollLeft + viewportWidth - padding;

  if (activeStart >= visibleStart && activeEnd <= visibleEnd) return null;

  const requestedScrollLeft = activeStart + activeWidth / 2 - viewportWidth / 2;
  const targetScrollLeft = clamp(requestedScrollLeft, 0, maximumScrollLeft);

  return Math.abs(targetScrollLeft - currentScrollLeft) < 1 ? null : targetScrollLeft;
};
