const SYNTHETIC_PALETTES = [
  ['#14324a', '#8fb7c9', '#f5ede0'],
  ['#3f3a32', '#b1a58c', '#f3efe8'],
  ['#204438', '#85aa96', '#f7f0df'],
  ['#51313a', '#c18a8e', '#f5e7df'],
  ['#223b5a', '#84a8d0', '#f5f2eb'],
] as const;

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error('Synthetic canvas could not be encoded.'));
  }, type, quality);
});

export const createSyntheticPropertyImage = async (
  index: number,
  width = 1920,
  height = 1080,
) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable.');
  const [dark, mid, light] = SYNTHETIC_PALETTES[index % SYNTHETIC_PALETTES.length];

  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, mid);
  sky.addColorStop(0.58, light);
  sky.addColorStop(1, '#d2c5ad');
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  context.fillStyle = dark;
  context.fillRect(width * 0.12, height * 0.38, width * 0.76, height * 0.44);
  context.beginPath();
  context.moveTo(width * 0.08, height * 0.42);
  context.lineTo(width * 0.5, height * 0.14);
  context.lineTo(width * 0.92, height * 0.42);
  context.closePath();
  context.fill();

  context.fillStyle = '#dce9ed';
  const windowWidth = width * 0.12;
  const windowHeight = height * 0.19;
  for (let column = 0; column < 4; column += 1) {
    const x = width * (0.2 + column * 0.17);
    const y = height * (0.47 + (column % 2) * 0.035);
    context.fillRect(x, y, windowWidth, windowHeight);
    context.strokeStyle = '#ffffffaa';
    context.lineWidth = width * 0.006;
    context.strokeRect(x, y, windowWidth, windowHeight);
  }

  context.fillStyle = '#879b74';
  context.fillRect(0, height * 0.82, width, height * 0.18);
  context.fillStyle = '#ffffff';
  context.globalAlpha = 0.92;
  context.font = `600 ${Math.round(height * 0.055)}px -apple-system, BlinkMacSystemFont, sans-serif`;
  context.fillText(`Synthetic property view ${String(index + 1).padStart(2, '0')}`, width * 0.055, height * 0.1);
  context.globalAlpha = 1;

  return canvasToBlob(canvas, 'image/png');
};

const writeAscii = (view: DataView, offset: number, value: string) => {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
};

export type SyntheticVoiceActivityFixture =
  | 'short-pause'
  | 'long-silence'
  | 'edge-silence'
  | 'noise-floor'
  | 'isolated-spike';

export const SYNTHETIC_VOICE_ACTIVITY_DURATIONS: Readonly<Record<SyntheticVoiceActivityFixture, number>> = Object.freeze({
  'short-pause': 4,
  'long-silence': 10.5,
  'edge-silence': 5,
  'noise-floor': 5,
  'isolated-spike': 5,
});

const voiceAmplitudeAt = (fixture: SyntheticVoiceActivityFixture, timeSec: number) => {
  switch (fixture) {
    case 'short-pause':
      return (timeSec >= 0.5 && timeSec < 1.6) || (timeSec >= 1.9 && timeSec < 3) ? 0.18 : 0;
    case 'long-silence':
      return (timeSec >= 0.75 && timeSec < 2.5) || (timeSec >= 7.5 && timeSec < 9.5) ? 0.18 : 0;
    case 'edge-silence':
      return timeSec >= 1 && timeSec < 4 ? 0.18 : 0;
    case 'noise-floor':
      return timeSec >= 1.25 && timeSec < 3.75 ? 0.18 : 0;
    case 'isolated-spike':
      return timeSec >= 2 && timeSec < 2.03 ? 0.22 : 0;
  }
};

/**
 * Deterministic speech-like samples. Activity is left-channel only so the
 * right channel of a rendered fixture remains a clean music-gain probe.
 */
export const createSyntheticVoiceActivitySampleSource = (
  fixture: SyntheticVoiceActivityFixture,
  sampleRate = 48_000,
) => {
  const duration = SYNTHETIC_VOICE_ACTIVITY_DURATIONS[fixture];
  const length = Math.floor(duration * sampleRate);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  let noiseState = 0x12345678;
  for (let frame = 0; frame < length; frame += 1) {
    const timeSec = frame / sampleRate;
    const amplitude = voiceAmplitudeAt(fixture, timeSec);
    const syllableModulation = 0.72 + 0.28 * Math.sin(2 * Math.PI * 3.1 * timeSec) ** 2;
    noiseState = (Math.imul(noiseState, 1_664_525) + 1_013_904_223) >>> 0;
    const background = fixture === 'noise-floor'
      ? ((noiseState / 0xffff_ffff) * 2 - 1) * 0.004
      : 0;
    left[frame] = background + amplitude * syllableModulation * (
      0.78 * Math.sin(2 * Math.PI * 205 * timeSec)
      + 0.22 * Math.sin(2 * Math.PI * 410 * timeSec)
    );
  }
  const channels = [left, right] as const;
  return {
    duration,
    length,
    numberOfChannels: channels.length,
    sampleRate,
    getChannelData: (channel: number) => {
      const samples = channels[channel];
      if (!samples) throw new RangeError(`Synthetic audio channel ${channel} does not exist.`);
      return samples;
    },
  };
};

export const createRepresentativeVoiceActivitySampleSource = (
  duration: number,
  sampleRate = 48_000,
) => {
  const length = Math.floor(duration * sampleRate);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  for (let frame = 0; frame < length; frame += 1) {
    const timeSec = frame / sampleRate;
    const cycleTime = timeSec % 10;
    const amplitude = (cycleTime >= 0.75 && cycleTime < 3.25)
      || (cycleTime >= 7.5 && cycleTime < 9)
      ? 0.18
      : 0.003;
    left[frame] = amplitude * (
      0.78 * Math.sin(2 * Math.PI * 205 * timeSec)
      + 0.22 * Math.sin(2 * Math.PI * 410 * timeSec)
    );
  }
  const channels = [left, right] as const;
  return {
    duration,
    length,
    numberOfChannels: channels.length,
    sampleRate,
    getChannelData: (channel: number) => {
      const samples = channels[channel];
      if (!samples) throw new RangeError(`Synthetic audio channel ${channel} does not exist.`);
      return samples;
    },
  };
};

const createStereoPcm16Wav = (
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
) => {
  const channels = 2;
  const frameCount = Math.min(left.length, right.length);
  const bytesPerSample = 2;
  const dataBytes = frameCount * channels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const offset = 44 + frame * channels * bytesPerSample;
    view.setInt16(offset, Math.round(Math.max(-1, Math.min(1, left[frame] ?? 0)) * 0x7fff), true);
    view.setInt16(offset + bytesPerSample, Math.round(Math.max(-1, Math.min(1, right[frame] ?? 0)) * 0x7fff), true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
};

export const createSelfCreatedVoiceoverWav = (
  fixture: SyntheticVoiceActivityFixture = 'long-silence',
  sampleRate = 48_000,
) => {
  const source = createSyntheticVoiceActivitySampleSource(fixture, sampleRate);
  return createStereoPcm16Wav(
    source.getChannelData(0),
    source.getChannelData(1),
    sampleRate,
  );
};

export const createSelfCreatedMusicWav = (durationSec = 20, sampleRate = 48_000) => {
  const channels = 2;
  const frameCount = Math.floor(durationSec * sampleRate);
  const bytesPerSample = 2;
  const dataBytes = frameCount * channels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  const frequencies = [130.81, 164.81, 196, 246.94];
  for (let frame = 0; frame < frameCount; frame += 1) {
    const time = frame / sampleRate;
    const beat = Math.floor(time / 2) % frequencies.length;
    const fade = Math.min(1, time / 0.5, (durationSec - time) / 0.75);
    const tone = (
      Math.sin(2 * Math.PI * frequencies[beat] * time)
      + 0.45 * Math.sin(2 * Math.PI * frequencies[(beat + 2) % frequencies.length] * time)
    ) * 0.13 * Math.max(0, fade);
    const sample = Math.max(-1, Math.min(1, tone)) * 0x7fff;
    const offset = 44 + frame * channels * bytesPerSample;
    view.setInt16(offset, sample, true);
    view.setInt16(offset + bytesPerSample, sample, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
};

export const createSyntheticImageFiles = async (count: number) => Promise.all(
  Array.from({ length: count }, async (_, index) => new File(
    [await createSyntheticPropertyImage(index)],
    `synthetic-property-${String(index + 1).padStart(2, '0')}.png`,
    { type: 'image/png', lastModified: Date.UTC(2026, 7, 6) },
  )),
);
export const createSelfCreatedMusicFile = (durationSec = 20) => new File(
  [createSelfCreatedMusicWav(durationSec)],
  'aim-self-created-test-music.wav',
  { type: 'audio/wav', lastModified: Date.UTC(2026, 7, 6) },
);

export const createSelfCreatedVoiceoverFile = (
  fixture: SyntheticVoiceActivityFixture = 'long-silence',
) => new File(
  [createSelfCreatedVoiceoverWav(fixture)],
  `aim-self-created-${fixture}-voiceover.wav`,
  { type: 'audio/wav', lastModified: Date.UTC(2026, 7, 9) },
);
