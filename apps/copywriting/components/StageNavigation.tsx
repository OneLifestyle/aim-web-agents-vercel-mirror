import React, { useCallback, useEffect, useRef } from 'react';
import type { CampaignStageId } from '../types';
import { getStageRevealScrollLeft } from './stageNavigationVisibility';

export type StageNavigationState = 'not-started' | 'in-review' | 'approved' | 'optional-off' | 'needs-attention' | 'ready';

type StageItem = {
  id: CampaignStageId;
  label: string;
  state: StageNavigationState;
  stateLabel: string;
};

type StageNavigationProps = {
  activeStage: CampaignStageId;
  stages: StageItem[];
  onSelect: (stage: CampaignStageId) => void;
};

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M2.5 7.2 5.6 10 11.5 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const StageNavigation: React.FC<StageNavigationProps> = ({ activeStage, stages, onSelect }) => {
  const navigationRef = useRef<HTMLElement>(null);
  const activeButtonRef = useRef<HTMLButtonElement>(null);

  const revealActiveStage = useCallback(() => {
    const navigation = navigationRef.current;
    const activeButton = activeButtonRef.current;
    if (!navigation || !activeButton) return;

    const navigationBounds = navigation.getBoundingClientRect();
    const activeButtonBounds = activeButton.getBoundingClientRect();
    const targetScrollLeft = getStageRevealScrollLeft({
      activeStart: navigation.scrollLeft + activeButtonBounds.left - navigationBounds.left,
      activeWidth: activeButtonBounds.width,
      contentWidth: navigation.scrollWidth,
      edgePadding: 12,
      scrollLeft: navigation.scrollLeft,
      viewportWidth: navigation.clientWidth,
    });
    if (targetScrollLeft === null) return;

    navigation.scrollTo({
      left: targetScrollLeft,
      behavior: 'auto',
    });
  }, []);

  useEffect(() => {
    revealActiveStage();
  }, [activeStage, revealActiveStage]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const navigation = navigationRef.current;
    const activeButton = activeButtonRef.current;
    if (!navigation || !activeButton) return undefined;

    let revealFrame: number | null = null;
    const scheduleReveal = () => {
      if (revealFrame !== null) window.cancelAnimationFrame(revealFrame);
      revealFrame = window.requestAnimationFrame(() => {
        revealFrame = null;
        revealActiveStage();
      });
    };
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleReveal);

    resizeObserver?.observe(navigation);
    resizeObserver?.observe(activeButton);
    window.addEventListener('resize', scheduleReveal);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleReveal);
      if (revealFrame !== null) window.cancelAnimationFrame(revealFrame);
    };
  }, [activeStage, revealActiveStage]);

  return (
    <nav ref={navigationRef} className="stage-nav" aria-label="Campaign stages">
      <p className="stage-nav__title">Preparation</p>
      <ol>
        {stages.map((stage, index) => (
          <li key={stage.id}>
            <button
              ref={activeStage === stage.id ? activeButtonRef : undefined}
              className="stage-nav__button"
              type="button"
              data-stage-id={stage.id}
              data-state={stage.state}
              aria-current={activeStage === stage.id ? 'step' : undefined}
              onClick={() => onSelect(stage.id)}
            >
              <span className="stage-nav__number" aria-hidden="true">
                {stage.state === 'approved' || stage.state === 'ready' ? <CheckIcon /> : index + 1}
              </span>
              <span>
                <span className="stage-nav__label">{stage.label}</span>
                <span className="stage-nav__state">{stage.stateLabel}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
};
