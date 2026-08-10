import React, { useEffect, useRef } from 'react';
import type { CampaignStageId } from '../types';

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

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia('(max-width: 1100px)').matches) return;
    const navigation = navigationRef.current;
    const activeButton = activeButtonRef.current;
    if (!navigation || !activeButton) return;

    const navigationBounds = navigation.getBoundingClientRect();
    const activeButtonBounds = activeButton.getBoundingClientRect();
    const isFullyVisible = activeButtonBounds.left >= navigationBounds.left
      && activeButtonBounds.right <= navigationBounds.right;
    if (isFullyVisible) return;

    const navigationCentre = navigationBounds.left + navigationBounds.width / 2;
    const activeButtonCentre = activeButtonBounds.left + activeButtonBounds.width / 2;
    navigation.scrollTo({
      left: navigation.scrollLeft + activeButtonCentre - navigationCentre,
      behavior: 'auto',
    });
  }, [activeStage]);

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
