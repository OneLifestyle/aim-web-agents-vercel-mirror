import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const typeAt = (buffer, offset) => buffer.toString('ascii', offset, offset + 4);

const readBoxes = (buffer, start, end) => {
  const boxes = [];
  let offset = start;
  while (offset + 8 <= end) {
    let size = buffer.readUInt32BE(offset);
    const type = typeAt(buffer, offset + 4);
    let headerSize = 8;
    if (size === 1) {
      if (offset + 16 > end) break;
      size = Number(buffer.readBigUInt64BE(offset + 8));
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < headerSize || offset + size > end) break;
    boxes.push({ type, start: offset, dataStart: offset + headerSize, end: offset + size, size });
    offset += size;
  }
  return boxes;
};

const child = (buffer, box, type, skip = 0) =>
  readBoxes(buffer, box.dataStart + skip, box.end).find((candidate) => candidate.type === type);

const parseTimeBox = (buffer, box) => {
  const version = buffer.readUInt8(box.dataStart);
  const timescaleOffset = box.dataStart + (version === 1 ? 20 : 12);
  const durationOffset = box.dataStart + (version === 1 ? 24 : 16);
  const timescale = buffer.readUInt32BE(timescaleOffset);
  const durationUnits = version === 1
    ? Number(buffer.readBigUInt64BE(durationOffset))
    : buffer.readUInt32BE(durationOffset);
  return { timescale, durationUnits, durationSec: timescale ? durationUnits / timescale : 0 };
};

const parseTrack = (buffer, trak) => {
  const tkhd = child(buffer, trak, 'tkhd');
  const mdia = child(buffer, trak, 'mdia');
  if (!tkhd || !mdia) throw new Error('MP4 track is missing tkhd or mdia metadata.');
  const mdhd = child(buffer, mdia, 'mdhd');
  const hdlr = child(buffer, mdia, 'hdlr');
  const minf = child(buffer, mdia, 'minf');
  const stbl = minf && child(buffer, minf, 'stbl');
  const stsd = stbl && child(buffer, stbl, 'stsd');
  const stts = stbl && child(buffer, stbl, 'stts');
  if (!mdhd || !hdlr || !stsd || !stts) throw new Error('MP4 track sample metadata is incomplete.');

  const handlerType = typeAt(buffer, hdlr.dataStart + 8);
  const entries = readBoxes(buffer, stsd.dataStart + 8, stsd.end);
  const sampleEntry = entries[0];
  if (!sampleEntry) throw new Error('MP4 track has no sample entry.');
  const timing = parseTimeBox(buffer, mdhd);
  const sttsEntryCount = buffer.readUInt32BE(stts.dataStart + 4);
  let sampleCount = 0;
  let sampleDurationUnits = 0;
  for (let index = 0; index < sttsEntryCount; index += 1) {
    const offset = stts.dataStart + 8 + index * 8;
    const count = buffer.readUInt32BE(offset);
    const delta = buffer.readUInt32BE(offset + 4);
    sampleCount += count;
    sampleDurationUnits += count * delta;
  }

  const track = {
    handlerType,
    sampleEntry: sampleEntry.type,
    durationSec: timing.durationSec,
    timescale: timing.timescale,
    sampleCount,
    sampleDurationSec: timing.timescale ? sampleDurationUnits / timing.timescale : 0,
  };

  if (handlerType === 'vide') {
    return {
      ...track,
      width: buffer.readUInt32BE(tkhd.end - 8) / 65_536,
      height: buffer.readUInt32BE(tkhd.end - 4) / 65_536,
      frameRate: timing.durationSec ? sampleCount / timing.durationSec : 0,
    };
  }
  if (handlerType === 'soun') {
    return {
      ...track,
      channels: buffer.readUInt16BE(sampleEntry.start + 24),
      sampleSizeBits: buffer.readUInt16BE(sampleEntry.start + 26),
      sampleRate: buffer.readUInt32BE(sampleEntry.start + 32) / 65_536,
    };
  }
  return track;
};

export const inspectMp4Atoms = async (filePath) => {
  const buffer = await readFile(filePath);
  const boxes = readBoxes(buffer, 0, buffer.length);
  const ftyp = boxes.find((box) => box.type === 'ftyp');
  const moov = boxes.find((box) => box.type === 'moov');
  const mdat = boxes.find((box) => box.type === 'mdat');
  if (!ftyp || !moov || !mdat) throw new Error('File is not a complete ISO Base Media MP4.');
  const mvhd = child(buffer, moov, 'mvhd');
  if (!mvhd) throw new Error('MP4 movie header is missing.');
  const tracks = readBoxes(buffer, moov.dataStart, moov.end)
    .filter((box) => box.type === 'trak')
    .map((track) => parseTrack(buffer, track));
  const compatibleBrands = [];
  for (let offset = ftyp.dataStart + 8; offset + 4 <= ftyp.end; offset += 4) {
    compatibleBrands.push(typeAt(buffer, offset));
  }
  return {
    inspectionMethod: 'independent Node ISO-BMFF atom parser (no renderer library)',
    fileSizeBytes: buffer.length,
    topLevelAtoms: boxes.map((box) => box.type),
    majorBrand: typeAt(buffer, ftyp.dataStart),
    compatibleBrands,
    movieDurationSec: parseTimeBox(buffer, mvhd).durationSec,
    video: tracks.find((track) => track.handlerType === 'vide') ?? null,
    audio: tracks.find((track) => track.handlerType === 'soun') ?? null,
  };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = process.argv[2];
  if (!target) throw new Error('Usage: node scripts/mp4-atom-inspector.mjs <file.mp4>');
  process.stdout.write(`${JSON.stringify(await inspectMp4Atoms(target), null, 2)}\n`);
}
