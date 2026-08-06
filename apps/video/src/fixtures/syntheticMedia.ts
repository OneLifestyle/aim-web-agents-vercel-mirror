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
