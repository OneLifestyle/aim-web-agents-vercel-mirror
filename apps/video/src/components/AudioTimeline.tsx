import { useMemo } from 'react';
import { createGainEnvelopePoints } from '../audio/mixAudio';
import { resolveAudioPlacement } from '../audio/placement';
import { getProjectVoiceActivitySegments } from '../audio/voiceActivity';
import type { AudioTrack, VideoProject } from '../project/schemas';
import { getProjectDurationSec } from '../project/timeline';

interface AudioTimelineProps {
  project: VideoProject;
  currentTimeSec: number;
}

const formatDuration = (seconds: number) => {
  const bounded = Math.max(0, seconds);
  const minutes = Math.floor(bounded / 60);
  const remainder = Math.round((bounded % 60) * 10) / 10;
  return minutes > 0
    ? `${minutes}:${String(Math.floor(remainder)).padStart(2, '0')}`
    : `${remainder.toFixed(remainder % 1 === 0 ? 0 : 1)}s`;
};

const percent = (value: number, durationSec: number) => (
  durationSec > 0 ? Math.max(0, Math.min(100, value / durationSec * 100)) : 0
);

const placementStyle = (track: AudioTrack, projectDurationSec: number) => ({
  left: `${percent(track.startTimeSec, projectDurationSec)}%`,
  width: `${percent(track.durationSec, projectDurationSec)}%`,
});

const GainCurve = ({
  points,
  durationSec,
}: {
  points: ReturnType<typeof createGainEnvelopePoints>;
  durationSec: number;
}) => {
  const path = points.map((point, index) => {
    const x = percent(point.timeSec, durationSec) * 10;
    const y = 3 + (1 - point.gain) * 26;
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(3)},${y.toFixed(3)}`;
  }).join(' ');

  return (
    <div className="audio-timeline__curve" aria-label="Resulting music level across the complete project">
      {path ? (
        <svg viewBox="0 0 1000 32" preserveAspectRatio="none" role="img" aria-label="Music duck and recovery gain curve">
          <path d={`${path} L1000,32 L0,32 Z`} className="audio-timeline__curve-fill" />
          <path d={path} className="audio-timeline__curve-line" />
        </svg>
      ) : <span className="audio-timeline__empty">Add music to see its level.</span>}
    </div>
  );
};

export function AudioTimeline({ project, currentTimeSec }: AudioTimelineProps) {
  const projectDurationSec = getProjectDurationSec(project);
  const { musicPlacement, voicePlacement } = useMemo(() => {
    const persistedMusic = project.audioTracks.find((track) => track.kind === 'music');
    const persistedVoiceover = project.audioTracks.find((track) => track.kind === 'voiceover');
    return {
      musicPlacement: persistedMusic ? resolveAudioPlacement(project, persistedMusic) : undefined,
      voicePlacement: persistedVoiceover ? resolveAudioPlacement(project, persistedVoiceover) : undefined,
    };
  }, [project]);
  const music = musicPlacement?.track;
  const voiceover = voicePlacement?.track;
  const speechSegments = useMemo(() => getProjectVoiceActivitySegments(project), [project]);
  const gainPoints = useMemo(
    () => music ? createGainEnvelopePoints(music, project, projectDurationSec) : [],
    [music, project, projectDurationSec],
  );
  const fadeOutStartSec = music
    ? Math.max(music.startTimeSec, music.startTimeSec + music.durationSec - music.fadeOutSec)
    : null;
  const playheadLeft = percent(currentTimeSec, projectDurationSec);

  return (
    <section
      className="audio-timeline"
      aria-labelledby="audio-timeline-heading"
      data-testid="operator-audio-timeline"
      data-project-duration={projectDurationSec}
      data-music-source-duration={musicPlacement?.sourceDurationSec ?? ''}
      data-music-used-duration={musicPlacement?.usedDurationSec ?? ''}
      data-music-end={musicPlacement?.endTimeSec ?? ''}
      data-music-fade-out-start={fadeOutStartSec ?? ''}
      data-voice-source-duration={voicePlacement?.sourceDurationSec ?? ''}
      data-voice-used-duration={voicePlacement?.usedDurationSec ?? ''}
      data-voice-end={voicePlacement?.endTimeSec ?? ''}
      data-speech-segments={JSON.stringify(speechSegments)}
      data-music-gain-points={JSON.stringify(gainPoints)}
    >
      <div className="audio-timeline__heading">
        <div>
          <h3 id="audio-timeline-heading">Audio timeline</h3>
          <p>Automatic placement and speech-aware music level across the complete preview.</p>
        </div>
        <span>{formatDuration(projectDurationSec)} project</span>
      </div>

      <div className="audio-timeline__axis" aria-hidden="true">
        <span />
        <div><span>0:00</span><span>{formatDuration(projectDurationSec / 2)}</span><span>{formatDuration(projectDurationSec)}</span></div>
      </div>

      <div className="audio-timeline__row">
        <div className="audio-timeline__label">
          <strong>Music</strong>
          <span>{musicPlacement
            ? `Source ${formatDuration(musicPlacement.sourceDurationSec)} · Used ${formatDuration(musicPlacement.usedDurationSec)}`
            : 'No music added'}</span>
        </div>
        <div className="audio-timeline__track" aria-label="Music placement">
          {music ? (
            <div className="audio-timeline__placement audio-timeline__placement--music" style={placementStyle(music, projectDurationSec)}>
              {music.fadeInSec > 0 ? (
                <span className="audio-timeline__fade audio-timeline__fade--in" style={{ width: `${percent(music.fadeInSec, music.durationSec)}%` }} />
              ) : null}
              {music.fadeOutSec > 0 ? (
                <span className="audio-timeline__fade audio-timeline__fade--out" style={{ width: `${percent(music.fadeOutSec, music.durationSec)}%` }} />
              ) : null}
            </div>
          ) : <span className="audio-timeline__empty">No placement</span>}
          <span className="audio-timeline__playhead" style={{ left: `${playheadLeft}%` }} />
        </div>
      </div>

      <div className="audio-timeline__row">
        <div className="audio-timeline__label">
          <strong>Voiceover</strong>
          <span>{voicePlacement
            ? `Source ${formatDuration(voicePlacement.sourceDurationSec)} · Used ${formatDuration(voicePlacement.usedDurationSec)}`
            : 'No voiceover added'}</span>
        </div>
        <div className="audio-timeline__track audio-timeline__track--voice" aria-label="Voiceover placement and detected speech">
          {voiceover ? (
            <div className="audio-timeline__placement audio-timeline__placement--voice" style={placementStyle(voiceover, projectDurationSec)}>
              <span className="audio-timeline__silence" title="Meaningful voiceover silence" />
            </div>
          ) : <span className="audio-timeline__empty">No placement</span>}
          {speechSegments.map((segment) => (
            <span
              className="audio-timeline__speech"
              key={`${segment.startTimeSec}-${segment.endTimeSec}`}
              title="Detected speech"
              style={{
                left: `${percent(segment.startTimeSec, projectDurationSec)}%`,
                width: `${percent(segment.endTimeSec - segment.startTimeSec, projectDurationSec)}%`,
              }}
            />
          ))}
          <span className="audio-timeline__playhead" style={{ left: `${playheadLeft}%` }} />
        </div>
      </div>

      <div className="audio-timeline__row audio-timeline__row--curve">
        <div className="audio-timeline__label">
          <strong>Music level</strong>
          <span>Duck · recover · final fade</span>
        </div>
        <div className="audio-timeline__track">
          <GainCurve points={gainPoints} durationSec={projectDurationSec} />
          <span className="audio-timeline__playhead" style={{ left: `${playheadLeft}%` }} />
        </div>
      </div>

      <div className="audio-timeline__legend" aria-label="Audio timeline legend">
        <span><i className="audio-timeline__key audio-timeline__key--speech" /> Speech</span>
        <span><i className="audio-timeline__key audio-timeline__key--silence" /> Voice silence</span>
        <span><i className="audio-timeline__key audio-timeline__key--fade" /> Music fade</span>
      </div>
    </section>
  );
}
