import {
  BlobSource,
  EncodedPacketSink,
  Input,
  MP4,
} from 'mediabunny';

export interface Mp4Inspection {
  container: 'MP4';
  mimeType: string;
  sizeBytes: number;
  durationSec: number;
  videoDurationSec: number;
  audioDurationSec: number | null;
  width: number;
  height: number;
  aspectRatio: number;
  frameRate: number;
  frameCount: number;
  videoCodec: string;
  audioCodec: string | null;
  audioChannels: number | null;
  audioSampleRate: number | null;
  colorSpace: VideoColorSpaceInit;
}

export const inspectMp4Blob = async (blob: Blob): Promise<Mp4Inspection> => {
  const input = new Input({ source: new BlobSource(blob), formats: [MP4] });
  try {
    const format = await input.getFormat();
    if (format !== MP4) throw new Error('Rendered output is not an MP4 container.');
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) throw new Error('Rendered MP4 does not contain a video track.');
    const audioTrack = await input.getPrimaryAudioTrack();
    const durationSec = await input.computeDuration();
    const videoDurationSec = await videoTrack.computeDuration();
    const audioDurationSec = audioTrack ? await audioTrack.computeDuration() : null;
    const packetSink = new EncodedPacketSink(videoTrack);
    let frameCount = 0;
    for await (const packet of packetSink.packets()) {
      if (packet) frameCount += 1;
    }
    const width = await videoTrack.getDisplayWidth();
    const height = await videoTrack.getDisplayHeight();

    return {
      container: 'MP4',
      mimeType: await input.getMimeType(),
      sizeBytes: blob.size,
      durationSec,
      videoDurationSec,
      audioDurationSec,
      width,
      height,
      aspectRatio: width / height,
      frameRate: videoDurationSec > 0 ? frameCount / videoDurationSec : 0,
      frameCount,
      videoCodec: (await videoTrack.getCodec()) ?? 'unknown',
      audioCodec: audioTrack ? await audioTrack.getCodec() : null,
      audioChannels: audioTrack ? await audioTrack.getNumberOfChannels() : null,
      audioSampleRate: audioTrack ? await audioTrack.getSampleRate() : null,
      colorSpace: await videoTrack.getColorSpace(),
    };
  } finally {
    input.dispose();
  }
};
