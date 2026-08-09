import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { deflateSync } from 'node:zlib';
import { chromium } from 'playwright-core';
import { inspectMp4Atoms } from './mp4-atom-inspector.mjs';

const mode = process.argv.includes('--mode')
  ? process.argv[process.argv.indexOf('--mode') + 1]
  : 'e2e';
const appRoot = process.cwd();
const outputRoot = path.join(appRoot, 'verification-output');
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 5200 + (process.pid % 500);
let url = `http://127.0.0.1:${port}/`;

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

const crc32 = (data) => {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const pngChunk = (type, data) => {
  const typeBytes = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return chunk;
};

const createSyntheticPng = (seed, width = 640, height = 360) => {
  const row = Buffer.alloc(width * 4 + 1);
  row[0] = 0;
  for (let x = 0; x < width; x += 1) {
    const offset = 1 + x * 4;
    row[offset] = (seed * 37 + x) % 256;
    row[offset + 1] = (seed * 67 + Math.floor(x / 3)) % 256;
    row[offset + 2] = (seed * 97 + Math.floor(x / 7)) % 256;
    row[offset + 3] = 255;
  }
  const raw = Buffer.alloc(row.length * height);
  for (let y = 0; y < height; y += 1) row.copy(raw, y * row.length);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
};

const waitForServer = async (targetUrl = url) => {
  const started = Date.now();
  while (Date.now() - started < 20_000) {
    try {
      const response = await fetch(targetUrl);
      if (response.ok) return;
    } catch {
      // The bounded retry handles the short Vite startup window.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Local Vite verification server did not become ready.');
};

await access(chromePath);
await mkdir(outputRoot, { recursive: true });

let server = null;
server = spawn(
  process.execPath,
  [path.join(appRoot, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: appRoot, stdio: ['ignore', 'pipe', 'pipe'] },
);
server.stdout.on('data', (chunk) => process.stdout.write(chunk));
server.stderr.on('data', (chunk) => process.stderr.write(chunk));

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--enable-precise-memory-info'],
  });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const consoleProblems = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => consoleProblems.push(`pageerror: ${error.message}`));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('button') !== null);

  const loadFixture = async (count, variant = 'branded') => {
    const loaded = await page.evaluate(async ({ fixtureCount, outputVariant }) => {
      if (!window.__AIM_VIDEO_TEST__) throw new Error('Browser verification API is unavailable.');
      return window.__AIM_VIDEO_TEST__.loadFixture(fixtureCount, outputVariant);
    }, { fixtureCount: count, outputVariant: variant });
    await page.waitForFunction((shots) => document.querySelectorAll('[data-shot-id]').length === shots, loaded.shots);
    return loaded;
  };

  const loadVoiceoverFixture = async () => {
    const loaded = await page.evaluate(async () => {
      if (!window.__AIM_VIDEO_TEST__) throw new Error('Browser verification API is unavailable.');
      return window.__AIM_VIDEO_TEST__.loadVoiceoverFixture();
    });
    await page.waitForFunction((shots) => document.querySelectorAll('[data-shot-id]').length === shots, loaded.shots);
    return loaded;
  };

  const loadAudioRepairFixture = async () => {
    const loaded = await page.evaluate(async () => {
      if (!window.__AIM_VIDEO_TEST__) throw new Error('Browser verification API is unavailable.');
      return window.__AIM_VIDEO_TEST__.loadAudioRepairFixture();
    });
    await page.waitForFunction((shots) => document.querySelectorAll('[data-shot-id]').length === shots, loaded.shots);
    await page.getByTestId('operator-audio-timeline').waitFor();
    return loaded;
  };

  const memorySnapshot = () => page.evaluate(() => {
    const memory = performance.memory;
    return memory ? {
      usedJsHeapBytes: memory.usedJSHeapSize,
      totalJsHeapBytes: memory.totalJSHeapSize,
      limitBytes: memory.jsHeapSizeLimit,
    } : null;
  });

  const renderFixture = async (label, { download = true, cancelAtFrame, cancelAtStage } = {}) => {
    const targetPath = path.join(outputRoot, `${label}.mp4`);
    let settled = false;
    let peakUsedJsHeapBytes = 0;
    const downloadPromise = download ? page.waitForEvent('download', { timeout: 300_000 }) : null;
    const renderPromise = page.evaluate(async ({ shouldDownload, frameToCancel, stageToCancel }) => {
      if (!window.__AIM_VIDEO_TEST__) throw new Error('Browser verification API is unavailable.');
      return window.__AIM_VIDEO_TEST__.renderDirect({
        download: shouldDownload,
        cancelAtFrame: frameToCancel,
        cancelAtStage: stageToCancel,
      });
    }, { shouldDownload: download, frameToCancel: cancelAtFrame, stageToCancel: cancelAtStage }).finally(() => { settled = true; });

    while (!settled) {
      const memory = await memorySnapshot();
      peakUsedJsHeapBytes = Math.max(peakUsedJsHeapBytes, memory?.usedJsHeapBytes ?? 0);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const result = await renderPromise;
    if (downloadPromise) {
      const received = await downloadPromise;
      await received.saveAs(targetPath);
    }
    const independentInspection = download ? await inspectMp4Atoms(targetPath) : undefined;
    return {
      ...result,
      peakUsedJsHeapBytes,
      path: download ? targetPath : undefined,
      independentInspection,
    };
  };

  const assertAlphaProfile = (result, label) => {
    assert(!result.error, result.error ?? `${label} render failed.`);
    const inspection = result.inspection;
    assert(inspection.container === 'MP4', `${label} is not an MP4 container.`);
    assert(inspection.videoCodec === 'avc' && inspection.audioCodec === 'aac', `${label} is not H.264 plus AAC.`);
    assert(inspection.width === 1920 && inspection.height === 1080, `${label} is not 1920 × 1080.`);
    assert(Math.abs(inspection.aspectRatio - 16 / 9) < 0.000001, `${label} is not 16:9.`);
    assert(Math.abs(inspection.frameRate - 30) < 0.1, `${label} is not 30 fps.`);
    assert(Math.abs(inspection.videoDurationSec - inspection.frameCount / 30) < 0.001, `${label} frame count and duration disagree.`);
    assert(inspection.durationSec - inspection.videoDurationSec >= 0 && inspection.durationSec - inspection.videoDurationSec <= 0.1, `${label} audio/container padding exceeds 100 ms.`);
    const megabytesPerMinute = result.sizeBytes / 1_000_000 / (inspection.videoDurationSec / 60);
    assert(megabytesPerMinute >= 15 && megabytesPerMinute <= 60, `${label} is outside the 15–60 MB/min planning range.`);
    assert(result.independentInspection.video?.sampleEntry === 'avc1', `${label} atom inspection did not find AVC.`);
    assert(result.independentInspection.audio?.sampleEntry === 'mp4a', `${label} atom inspection did not find MPEG-4 audio.`);
  };

  const evidence = {
    mode,
    generatedAt: new Date().toISOString(),
    browserVersion: await browser.version(),
    consoleProblems,
  };

  if (mode === 'e2e') {
    await page.getByRole('button', { name: 'Create local project' }).click();
    await page.getByLabel('Project name').fill('Local persistence UI proof');
    await page.getByText('Unsaved changes', { exact: true }).waitFor();
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Close' }).click();
    assert(await page.getByLabel('Project name').isVisible(), 'Dirty project closed without confirmation.');

    const mediaIntake = page.locator('section[aria-labelledby="media-heading"]');
    await mediaIntake.getByLabel('Photo source').fill('Locally generated browser verification files');
    await mediaIntake.getByLabel('Rights owner').fill('Singularealty / Real Estate AIM test fixture');
    await mediaIntake.getByLabel('Permission basis or reference').fill('Self-created synthetic test media');
    await mediaIntake.getByLabel(/I confirm these photographs/).check();
    await page.evaluate(() => window.__AIM_VIDEO_TEST__.setMediaValidationDelay(350));
    const syntheticPhotoPayloads = Array.from({ length: 15 }, (_, index) => ({
      name: `synthetic-intake-${String(index + 1).padStart(2, '0')}.png`,
      mimeType: 'text/plain',
      buffer: createSyntheticPng(index + 1),
    }));
    await page.getByTestId('photo-input').setInputFiles(syntheticPhotoPayloads);
    await page.getByText('Checking media…', { exact: true }).waitFor();
    assert(await page.getByRole('button', { name: /Save locally/ }).isDisabled(), 'Save stayed active during delayed media intake.');
    assert(await page.getByRole('button', { name: 'Close' }).isDisabled(), 'Close stayed active during delayed media intake.');
    await page.waitForFunction(() => document.querySelectorAll('[data-shot-id]').length === 15);
    await page.evaluate(() => window.__AIM_VIDEO_TEST__.setMediaValidationDelay(0));
    assert(await mediaIntake.getByText('15 / 30').isVisible(), 'Actual bulk input did not create 15 storyboard photographs.');
    await page.getByRole('button', { name: 'Save locally' }).click();
    await page.getByText('Saved', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Close' }).click();
    await page.evaluate(() => window.__AIM_VIDEO_TEST__.setProjectOpenDelay(350));
    await page.getByRole('button', { name: 'Open' }).click();
    await page.getByRole('button', { name: 'Create local project' }).click();
    await page.waitForTimeout(450);
    assert(await page.getByLabel('Project name').inputValue() === 'Untitled property video', 'A stale Open completion replaced the newer local project.');
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Close' }).click();
    await page.evaluate(() => window.__AIM_VIDEO_TEST__.setProjectOpenDelay(0));
    await page.getByRole('button', { name: 'Open' }).click();
    assert(await page.getByLabel('Project name').inputValue() === 'Local persistence UI proof', 'Renamed local project did not reopen with its saved name.');
    await page.waitForFunction(() => document.querySelectorAll('[data-shot-id]').length === 15);
    await page.getByRole('button', { name: 'Close' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete Local persistence UI proof' }).click();
    await page.getByText('No local projects yet. Create one to begin.').waitFor();

    const loaded = await loadFixture(15, 'branded');
    assert(loaded.shots === 15, 'Fifteen-shot fixture did not load.');
    assert(await page.locator('[data-shot-id]').count() === 15, 'Storyboard did not render 15 shot cards.');
    const motionValues = await page.locator('select[aria-label^="Motion for shot"]').evaluateAll((elements) => elements.map((element) => element.value));
    for (const preset of ['still', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right']) {
      assert(motionValues.includes(preset), `Storyboard is missing ${preset}.`);
    }
    assert(await page.getByText(/deterministic cross-dissolve proxy/i).count() === 1, 'Image Pair dissolve disclosure is missing.');
    assert(
      await page.locator('body').getByText(/render graph|frame evaluator|crop evaluator|source hash|schema version|codec internals|shot hash|render-cache/i).count() === 0,
      'Primary operator UI exposes internal production terminology.',
    );
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.waitForTimeout(500);
    const exportTargetVisible = await page.locator('#export-video').evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.top < window.innerHeight && rect.bottom > 0;
    });
    assert(exportTargetVisible, 'Header Export did not reveal the MP4 output controls.');

    const beforeDrag = await page.evaluate(() => window.__AIM_VIDEO_TEST__.state().orderedShotIds);
    const dragHandleReady = await page.evaluate(() => {
      const source = document.querySelector('[data-testid="shot-card-1"] [draggable="true"]');
      const target = document.querySelector('[data-testid="shot-card-3"]');
      if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) return false;
      const dataTransfer = new DataTransfer();
      source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
      source.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer }));
      return source.draggable;
    });
    assert(dragHandleReady, 'Storyboard drag handle was not available as a draggable control.');
    await page.waitForFunction((firstShotId) => window.__AIM_VIDEO_TEST__?.state().orderedShotIds[1] === firstShotId, beforeDrag[0]);
    const afterDrag = await page.evaluate(() => window.__AIM_VIDEO_TEST__.state().orderedShotIds);
    assert(
      afterDrag[1] === beforeDrag[0],
      `Drag reorder did not move the first stable shot before shot 3: ${JSON.stringify({ beforeDrag, afterDrag })}`,
    );
    await page.getByRole('button', { name: 'Move shot 2 up' }).click();
    const afterMoveUp = await page.evaluate(() => window.__AIM_VIDEO_TEST__.state().orderedShotIds);
    assert(afterMoveUp[0] === beforeDrag[0], 'Move Up did not restore the dragged shot.');

    await page.getByRole('button', { name: 'Remove shot 15' }).click();
    assert(await page.locator('[data-shot-id]').count() === 14, 'Remove did not delete one storyboard shot.');
    await loadFixture(15, 'branded');

    const beforeMove = await page.evaluate(() => window.__AIM_VIDEO_TEST__.state().orderedShotIds);
    await page.getByRole('button', { name: 'Move shot 1 down' }).click();
    const afterMove = await page.evaluate(() => window.__AIM_VIDEO_TEST__.state().orderedShotIds);
    assert(afterMove[1] === beforeMove[0], 'Move Down did not reorder the first shot.');

    await page.getByRole('button', { name: 'Play' }).click();
    await page.waitForTimeout(350);
    await page.getByRole('button', { name: 'Pause' }).click();
    const previewTime = Number(await page.getByLabel('Seek complete video').inputValue());
    assert(previewTime > 0, 'Complete preview did not advance.');

    const beforeCloseState = await page.evaluate(() => window.__AIM_VIDEO_TEST__.state());
    await page.getByRole('button', { name: 'Save locally' }).click();
    await page.getByText('Saved', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'Open' }).first().click();
    await page.waitForFunction(() => document.querySelectorAll('[data-shot-id]').length === 15);
    const afterCloseState = await page.evaluate(() => window.__AIM_VIDEO_TEST__.state());
    assert(
      JSON.stringify(afterCloseState.shotSignatures) === JSON.stringify(beforeCloseState.shotSignatures),
      'Close/reopen changed stable shot IDs, source references, durations or hashes.',
    );
    const reopened = await page.evaluate(() => window.__AIM_VIDEO_TEST__.saveAndReopen());
    assert(
      reopened.shots === 15
      && reopened.missingAssetIds.length === 0
      && reopened.corruptAssetIds.length === 0,
      'Save/reopen lost or corrupted fixture media.',
    );
    const replaced = await page.evaluate(() => window.__AIM_VIDEO_TEST__.replaceFirstShot());
    assert(replaced.stableShotId && replaced.settingsRetained && replaced.otherShotsUnchanged, 'Shot replacement changed unrelated settings.');
    await page.getByText('Unsaved changes', { exact: true }).waitFor();
    await page.waitForFunction(
      (expectedAssets) => window.__AIM_VIDEO_TEST__?.state().assets === expectedAssets,
      loaded.assets + 1,
    );
    const assetsBeforeClear = await page.evaluate(() => window.__AIM_VIDEO_TEST__.state().assets);
    await page.getByRole('button', { name: /Clear unused media \(1\)/ }).click();
    await page.waitForFunction(
      (expectedAssets) => window.__AIM_VIDEO_TEST__?.state().assets === expectedAssets,
      assetsBeforeClear - 1,
    );
    const assetsAfterClear = await page.evaluate(() => window.__AIM_VIDEO_TEST__.state().assets);
    assert(assetsAfterClear === assetsBeforeClear - 1, 'Clear unused media did not remove the replaced source blob.');
    const retimed = await page.evaluate(() => window.__AIM_VIDEO_TEST__.retimeFirstShot(2.5));
    assert(retimed.stableShotId && retimed.otherShotsUnchanged && retimed.durationSec === 2.5, 'Shot retiming changed unrelated shots.');
    const reordered = await page.evaluate(() => window.__AIM_VIDEO_TEST__.reorderFirstToLast());
    assert(reordered.firstShotId === reordered.lastShotId, 'Drag-equivalent stable-ID reorder failed.');
    const unbrandedButton = page.getByRole('button', { name: /Unbranded 16:9/ });
    const brandedButton = page.getByRole('button', { name: /Branded 16:9/ });
    await unbrandedButton.click();
    assert(await unbrandedButton.getAttribute('aria-pressed') === 'true', 'Unbranded output did not expose its selected state.');
    assert(await page.getByLabel('Agent name').isDisabled(), 'Unbranded output left branded contact details active.');
    await brandedButton.click();
    assert(await brandedButton.getAttribute('aria-pressed') === 'true', 'Branded output did not expose its selected state.');
    assert(await page.getByLabel('Agent name').isEnabled(), 'Branded output did not restore contact details.');
    await page.screenshot({ path: path.join(outputRoot, 'fifteen-shot-workspace.png'), fullPage: true });
    await loadFixture(15, 'branded');
    await page.evaluate(() => window.__AIM_VIDEO_TEST__.replaceFirstShot());
    await page.waitForFunction(
      (expectedAssets) => window.__AIM_VIDEO_TEST__?.state().assets === expectedAssets,
      loaded.assets + 1,
    );
    const missingBeforeSave = await page.evaluate(() => window.__AIM_VIDEO_TEST__.removeFirstRuntimeAsset());
    assert(missingBeforeSave, 'Missing-on-save fixture could not remove a runtime asset.');
    await page.getByRole('button', { name: 'Save locally' }).click();
    await page.getByText(/is missing from local media/i).waitFor();
    const recoveredAfterRejectedSave = await page.evaluate(() => window.__AIM_VIDEO_TEST__.reopenWithoutSave());
    assert(
      recoveredAfterRejectedSave.missingAssetIds.length === 0
      && recoveredAfterRejectedSave.corruptAssetIds.length === 0,
      'Rejected incomplete save changed the previously valid local record.',
    );
    await loadFixture(15, 'branded');
    await page.evaluate(() => window.__AIM_VIDEO_TEST__.saveAndReopen());
    await page.evaluate(async () => {
      const database = await new Promise((resolve, reject) => {
        const request = indexedDB.open('aim-video-local-projects', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transaction = database.transaction('assets', 'readwrite');
      const store = transaction.objectStore('assets');
      const records = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const first = records[0];
      if (!first) throw new Error('No stored fixture asset was available to corrupt.');
      store.put({ ...first, blob: new Blob(['deliberately corrupt local fixture']) });
      await new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      database.close();
    });
    const corruptReopen = await page.evaluate(() => window.__AIM_VIDEO_TEST__.reopenWithoutSave());
    assert(corruptReopen.corruptAssetIds.length === 1 && corruptReopen.missingAssetIds.length === 0, 'Corrupt IndexedDB blob was not isolated by SHA-256 integrity validation.');
    await page.getByText('Saved', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Close' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete 15-shot synthetic property' }).click();

    await page.evaluate(async () => {
      const database = await new Promise((resolve, reject) => {
        const request = indexedDB.open('aim-video-local-projects', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transaction = database.transaction('projects', 'readwrite');
      const store = transaction.objectStore('projects');
      store.put({ id: 'corrupt-record', name: 42, updatedAt: {}, project: { version: '1.0.0' } });
      store.put({ id: 'unsupported-record', name: 'Unsupported local project', updatedAt: 'not-a-date', project: { version: '99.0.0' } });
      await new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      database.close();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText(/manifest is corrupt/i).waitFor();
    await page.getByText(/version 99\.0\.0 is not supported/i).waitFor();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete Corrupt local project' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete Unsupported local project' }).click();
    await page.getByText('No local projects yet. Create one to begin.').waitFor();
    const finalStoreCounts = await page.evaluate(async () => {
      const database = await new Promise((resolve, reject) => {
        const request = indexedDB.open('aim-video-local-projects', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transaction = database.transaction(['projects', 'assets'], 'readonly');
      const count = (storeName) => new Promise((resolve, reject) => {
        const request = transaction.objectStore(storeName).count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const [projects, assets] = await Promise.all([count('projects'), count('assets')]);
      database.close();
      return { projects, assets };
    });
    assert(finalStoreCounts.projects === 0 && finalStoreCounts.assets === 0, 'Delete left local project or Blob records behind.');
    evidence.fifteenShot = {
      loaded,
      dragReorder: true,
      moveUp: true,
      moveDown: true,
      remove: true,
      clearUnused: true,
      closeAndReopen: true,
      fullShotStateRetained: true,
      createRenameDelete: true,
      actualBulkInput: true,
      mediaIntakeLock: true,
      staleOpenProtected: true,
      corruptAndUnsupportedRecords: true,
      exportControlsReachable: true,
      operatorLanguageChecked: true,
      outputVariantStateChecked: true,
      finalStoreCounts,
      corruptBlobDetected: true,
      incompleteSaveRejected: true,
      reopened,
      corruptReopen,
      recoveredAfterRejectedSave,
      replaced,
      retimed,
      reordered,
      previewTime,
    };
  } else if (mode === 'canonical') {
    await loadFixture(6, 'branded');
    const canonical = await renderFixture('canonical-6-shot-branded');
    process.stdout.write(`CANONICAL_RESULT ${JSON.stringify(canonical)}\n`);
    assert(!canonical.error, canonical.error ?? 'Canonical render failed.');
    assert(canonical.inspection.container === 'MP4', 'Canonical output is not MP4.');
    assert(canonical.inspection.mimeType.includes('avc1.640028'), 'Canonical MIME metadata is not H.264 High Profile.');
    assert(canonical.inspection.mimeType.includes('mp4a.40.2'), 'Canonical MIME metadata is not AAC-LC.');
    assert(canonical.inspection.videoCodec === 'avc', 'Canonical video codec is not AVC/H.264.');
    assert(canonical.inspection.audioCodec === 'aac', 'Canonical audio codec is not AAC.');
    assert(canonical.inspection.width === 1920 && canonical.inspection.height === 1080, 'Canonical resolution is not 1920 × 1080.');
    assert(Math.abs(canonical.inspection.aspectRatio - 16 / 9) < 0.000001, 'Canonical display aspect ratio is not 16:9.');
    assert(
      Math.abs(canonical.inspection.frameRate - 30) < 0.1,
      `Canonical measured frame rate is ${canonical.inspection.frameRate}, not 30 fps.`,
    );
    assert(canonical.inspection.frameCount === 345, 'Canonical frame count is not the expected 345 frames.');
    assert(Math.abs(canonical.inspection.videoDurationSec - 11.5) < 0.001, 'Canonical video duration is not 11.5 seconds.');
    assert(canonical.inspection.durationSec >= canonical.inspection.videoDurationSec, 'Canonical container ends before its video track.');
    assert(canonical.inspection.durationSec - canonical.inspection.videoDurationSec <= 0.1, 'AAC/container padding exceeds the documented 100 ms tolerance.');
    const megabytesPerMinute = canonical.sizeBytes / 1_000_000 / (canonical.inspection.videoDurationSec / 60);
    assert(megabytesPerMinute >= 15 && megabytesPerMinute <= 60, 'Canonical file size is outside the 15–60 MB/min alpha planning range.');
    assert(canonical.independentInspection.majorBrand === 'isom', 'Independent atom inspection did not find the ISO Base Media brand.');
    assert(canonical.independentInspection.compatibleBrands.includes('mp41'), 'Independent atom inspection did not find MP4 compatibility.');
    assert(canonical.independentInspection.video?.sampleEntry === 'avc1', 'Independent atom inspection did not find an avc1 video track.');
    assert(canonical.independentInspection.audio?.sampleEntry === 'mp4a', 'Independent atom inspection did not find an mp4a audio track.');
    assert(canonical.independentInspection.video?.width === 1920 && canonical.independentInspection.video?.height === 1080, 'Independent atom inspection found the wrong video dimensions.');
    assert(Math.abs(canonical.independentInspection.video?.frameRate - 30) < 0.1, 'Independent atom inspection found the wrong frame rate.');
    assert(canonical.independentInspection.audio?.channels === 2 && canonical.independentInspection.audio?.sampleRate === 48000, 'Independent atom inspection found the wrong audio layout.');
    assert(canonical.parity.length >= 7, 'Canonical parity did not sample every shot and the end card.');
    assert(canonical.parity.every((sample) => sample.withinLossyTolerance), 'Canonical exported frames exceed parity tolerance.');
    evidence.canonical = canonical;
  } else if (mode === 'audio-repair') {
    const initial = await loadAudioRepairFixture();
    assert(initial.audio.projectDurationSec === 63, 'Founder-equivalent fixture did not begin at 63 seconds.');
    assert(initial.audio.musicSourceDurationSec === 75, 'Initial music source duration is not 75 seconds.');
    assert(initial.audio.musicUsedDurationSec === 63 && initial.audio.musicEndTimeSec === 63, 'Initial music placement does not end at 63 seconds.');
    assert(initial.audio.musicFadeOutStartSec === 61.5, 'Initial music fade is not relative to the 63-second endpoint.');
    assert(initial.audio.voiceoverSourceDurationSec === 60 && initial.audio.voiceoverEndTimeSec === 60, 'Initial voiceover does not retain its 60-second source endpoint.');

    const initialTimeline = page.getByTestId('operator-audio-timeline');
    assert(Number(await initialTimeline.getAttribute('data-project-duration')) === 63, 'Operator timeline did not render the initial 63-second axis.');
    assert(Number(await initialTimeline.getAttribute('data-music-end')) === 63, 'Operator timeline did not render the initial music endpoint.');

    const extended = await page.evaluate(() => window.__AIM_VIDEO_TEST__.retimeFirstShot(10));
    await page.waitForFunction(() => Number(document.querySelector('[data-testid="operator-audio-timeline"]')?.getAttribute('data-project-duration')) === 68);
    assert(extended.audio.projectDurationSec === 68, 'Shot retiming did not extend the project to 68 seconds.');
    assert(extended.audio.musicUsedDurationSec === 68 && extended.audio.musicEndTimeSec === 68, 'Music did not follow the 68-second project endpoint.');
    assert(extended.audio.musicFadeOutStartSec === 66.5, 'Music fade did not move to the 68-second project endpoint.');
    assert(extended.audio.voiceoverSourceDurationSec === 60 && extended.audio.voiceoverUsedDurationSec === 60 && extended.audio.voiceoverEndTimeSec === 60, 'Voiceover was incorrectly extended with the project.');
    assert(extended.audio.speechSegments.length === 2, 'Quieter resumed speech was not retained in the canonical envelope.');
    assert(extended.audio.speechSegments[0].startTimeSec <= 1.05 && extended.audio.speechSegments[0].endTimeSec >= 19.95, 'Initial speech interval is incorrect.');
    assert(extended.audio.speechSegments[1].startTimeSec <= 55.05 && extended.audio.speechSegments[1].endTimeSec >= 59.45, 'Quieter resumed-speech interval is incorrect.');
    assert(extended.audio.speechSegments[1].startTimeSec - extended.audio.speechSegments[0].endTimeSec > 34.8, 'Meaningful silence was not preserved.');
    assert(extended.audio.representativeMusicGains.firstSpeech < extended.audio.representativeMusicGains.meaningfulSilence * 0.35, 'Initial speech did not duck music.');
    assert(extended.audio.representativeMusicGains.quieterResumedSpeech < extended.audio.representativeMusicGains.meaningfulSilence * 0.35, 'Quieter resumed speech did not re-duck music.');
    assert(Math.abs(extended.audio.representativeMusicGains.postVoiceover - extended.audio.representativeMusicGains.meaningfulSilence) < 0.000001, 'Music did not return to normal after voiceover.');
    assert(extended.audio.representativeMusicGains.finalFade < extended.audio.representativeMusicGains.postVoiceover * 0.5, 'Final music fade is not near the 68-second endpoint.');
    assert(extended.audio.musicGainSchedule.at(-1).timeSec === 68 && extended.audio.musicGainSchedule.at(-1).gain === 0, 'Export gain schedule does not end at 68 seconds.');

    const timeline = page.getByTestId('operator-audio-timeline');
    assert(Number(await timeline.getAttribute('data-music-source-duration')) === 75, 'Timeline music source duration is incorrect.');
    assert(Number(await timeline.getAttribute('data-music-used-duration')) === 68, 'Timeline music used duration is incorrect.');
    assert(Number(await timeline.getAttribute('data-music-fade-out-start')) === 66.5, 'Timeline final fade region is incorrect.');
    assert(Number(await timeline.getAttribute('data-voice-source-duration')) === 60, 'Timeline voice source duration is incorrect.');
    assert(Number(await timeline.getAttribute('data-voice-used-duration')) === 60, 'Timeline voice used duration is incorrect.');
    assert(await timeline.locator('.audio-timeline__speech').count() === 2, 'Timeline does not display both speech-active regions.');
    assert(await timeline.locator('button, input, select').count() === 0, 'Operator timeline unexpectedly exposes editing controls.');

    const previewSection = page.locator('section[aria-labelledby="preview-heading"]');
    const previewSeek = page.getByLabel('Seek complete video');
    const seekPreview = async (timeSec) => {
      await previewSeek.evaluate((element, value) => {
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (!valueSetter) throw new Error('The browser did not expose the range value setter.');
        valueSetter.call(element, String(value));
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }, timeSec);
      return Number(await previewSection.getAttribute('data-preview-music-gain'));
    };
    const previewAppliedGains = {
      firstSpeech: await seekPreview(10),
      meaningfulSilence: await seekPreview(40),
      quieterResumedSpeech: await seekPreview(57),
      postVoiceover: await seekPreview(62),
      finalFade: await seekPreview(67.5),
    };
    for (const [label, applied] of Object.entries(previewAppliedGains)) {
      const intended = extended.audio.representativeMusicGains[label];
      assert(Math.abs(applied - intended) < 0.000001, `Preview ${label} gain ${applied} differs from canonical ${intended}.`);
    }
    const playheadLeft = Number((await timeline.locator('.audio-timeline__playhead').first().getAttribute('style'))?.match(/left:\s*([\d.]+)/)?.[1]);
    assert(Math.abs(playheadLeft - 67.5 / 68 * 100) < 0.01, 'Audio timeline playhead did not follow preview seek.');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.waitForTimeout(350);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const playedPlayheadLeft = Number((await timeline.locator('.audio-timeline__playhead').first().getAttribute('style'))?.match(/left:\s*([\d.]+)/)?.[1]);
    assert(playedPlayheadLeft > 0, 'Audio timeline playhead did not advance during preview playback.');
    await timeline.screenshot({ path: path.join(outputRoot, 'audio-repair-timeline.png') });

    const reopened = await page.evaluate(() => window.__AIM_VIDEO_TEST__.saveAndReopen());
    await page.waitForFunction(() => window.__AIM_VIDEO_TEST__?.state().audio?.projectDurationSec === 68);
    assert(reopened.missingAssetIds.length === 0 && reopened.corruptAssetIds.length === 0, 'Audio repair fixture save/reopen lost local media.');
    assert(reopened.audio.projectDurationSec === 68 && reopened.audio.musicEndTimeSec === 68, 'Save/reopen did not retain canonical music placement.');
    assert(reopened.audio.voiceoverEndTimeSec === 60 && reopened.voiceActivitySegments === 2, 'Save/reopen did not retain the voice source or activity envelope.');

    const shortened = await page.evaluate(() => window.__AIM_VIDEO_TEST__.retimeFirstShot(8));
    await page.waitForFunction(() => window.__AIM_VIDEO_TEST__?.state().audio?.projectDurationSec === 66);
    assert(shortened.audio.projectDurationSec === 66 && shortened.audio.musicEndTimeSec === 66 && shortened.audio.musicFadeOutStartSec === 64.5, 'Post-reopen shortening did not move music and fade to 66 seconds.');
    const restored = await page.evaluate(() => window.__AIM_VIDEO_TEST__.retimeFirstShot(10));
    await page.waitForFunction(() => window.__AIM_VIDEO_TEST__?.state().audio?.projectDurationSec === 68);
    assert(restored.audio.musicEndTimeSec === 68 && restored.audio.voiceoverEndTimeSec === 60, 'Post-reopen extension did not restore the canonical endpoints.');

    const rendered = await renderFixture('founder-audio-repair-68s-branded');
    assertAlphaProfile(rendered, 'Founder-equivalent audio repair output');
    assert(Math.abs(rendered.inspection.videoDurationSec - 68) < 0.001, 'Founder-equivalent MP4 video track is not 68 seconds.');
    assert(rendered.parity.every((sample) => sample.withinLossyTolerance), 'Founder-equivalent frame parity exceeded tolerance.');
    const audio = rendered.audioEvidence;
    assert(audio, 'Founder-equivalent exported audio evidence was not collected.');
    assert(audio.longSilenceRms > audio.speechOneRms * 2.4, 'Exported music did not recover in meaningful silence.');
    assert(audio.longSilenceRms > audio.speechTwoRms * 2.4, 'Exported music did not re-duck for quieter resumed speech.');
    assert(audio.postVoiceoverRms > audio.speechTwoRms * 2.4, 'Exported music did not return to normal after voiceover ended.');
    assert(audio.finalFadeRms < audio.postVoiceoverRms * 0.5, 'Exported music did not fade at the new 68-second endpoint.');
    assert(Math.abs(audio.intendedMusicGains.speechOne - previewAppliedGains.firstSpeech) < 0.000001, 'Preview/export first-speech gain intent differs.');
    assert(Math.abs(audio.intendedMusicGains.longSilence - previewAppliedGains.meaningfulSilence) < 0.000001, 'Preview/export silence gain intent differs.');
    assert(Math.abs(audio.intendedMusicGains.speechTwo - previewAppliedGains.quieterResumedSpeech) < 0.000001, 'Preview/export quieter-resumption gain intent differs.');
    assert(Math.abs(audio.intendedMusicGains.postVoiceover - previewAppliedGains.postVoiceover) < 0.000001, 'Preview/export post-voiceover gain intent differs.');
    assert(Math.abs(audio.intendedMusicGains.finalFade - previewAppliedGains.finalFade) < 0.000001, 'Preview/export final-fade gain intent differs.');

    evidence.audioRepair = {
      initial,
      extended: extended.audio,
      previewAppliedGains,
      reopened,
      shortened: shortened.audio,
      restored: restored.audio,
      render: rendered,
      timelineScreenshot: path.join(outputRoot, 'audio-repair-timeline.png'),
    };
  } else if (mode === 'voiceover') {
    const beforeAnalysisMemory = await memorySnapshot();
    const loaded = await loadVoiceoverFixture();
    const afterAnalysisMemory = await memorySnapshot();
    const analysisPerformance = await page.evaluate(() => window.__AIM_VIDEO_TEST__.measureVoiceAnalysisPerformance());
    assert(loaded.activeSegments === 2, 'Voiceover fixture did not detect two speech-active regions.');
    assert(loaded.analysisElapsedMs >= 0, 'Voiceover analysis timing was not recorded.');
    assert(await page.getByText('Reduce music while speech is detected', { exact: true }).isVisible(), 'Speech-aware ducking label is not visible.');

    const missingEnvelopeReopen = await page.evaluate(() => window.__AIM_VIDEO_TEST__.recalculateMissingEnvelopeAndReopen());
    assert(missingEnvelopeReopen.analysisPerformed, 'Missing derived analysis was not recalculated on reopen.');
    assert(missingEnvelopeReopen.persistedSegments === 2, 'Recalculated derived analysis was not persisted locally.');
    const saveReopen = await page.evaluate(() => window.__AIM_VIDEO_TEST__.saveAndReopen());
    assert(saveReopen.missingAssetIds.length === 0 && saveReopen.corruptAssetIds.length === 0, 'Voiceover fixture save/reopen lost local media.');
    assert(saveReopen.voiceActivitySegments === 2, 'Voice activity envelope was not retained across save/reopen.');

    const previewSection = page.locator('section[aria-labelledby="preview-heading"]');
    const previewSeek = page.getByLabel('Seek complete video');
    const previewAppliedGains = {};
    for (const [label, timeSec] of [['speechOne', 1.5], ['longSilence', 5], ['speechTwo', 8.25]]) {
      await previewSeek.evaluate((element, value) => {
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (!valueSetter) throw new Error('The browser did not expose the range value setter.');
        valueSetter.call(element, String(value));
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }, timeSec);
      const applied = Number(await previewSection.getAttribute('data-preview-music-gain'));
      assert(Number.isFinite(applied), `Preview did not expose applied music gain for ${label}.`);
      previewAppliedGains[label] = applied;
    }

    const rendered = await renderFixture('voiceover-speech-silence-speech-branded');
    assertAlphaProfile(rendered, 'Voiceover speech/silence/speech output');
    assert(rendered.parity.every((sample) => sample.withinLossyTolerance), 'Voiceover fixture frame parity exceeded tolerance.');
    const audio = rendered.audioEvidence;
    assert(audio, 'Rendered voiceover audio evidence was not collected.');
    assert(audio.intendedMusicGains.speechOne < audio.intendedMusicGains.longSilence * 0.35, 'Preview gain did not duck the first speech region.');
    assert(audio.intendedMusicGains.speechTwo < audio.intendedMusicGains.longSilence * 0.35, 'Preview gain did not duck resumed speech.');
    assert(Math.abs(previewAppliedGains.speechOne - audio.intendedMusicGains.speechOne) < 0.000001, `Actual preview music gain ${previewAppliedGains.speechOne} differed from ${audio.intendedMusicGains.speechOne} in first speech.`);
    assert(Math.abs(previewAppliedGains.longSilence - audio.intendedMusicGains.longSilence) < 0.000001, `Actual preview music gain ${previewAppliedGains.longSilence} differed from ${audio.intendedMusicGains.longSilence} in long silence.`);
    assert(Math.abs(previewAppliedGains.speechTwo - audio.intendedMusicGains.speechTwo) < 0.000001, `Actual preview music gain ${previewAppliedGains.speechTwo} differed from ${audio.intendedMusicGains.speechTwo} in resumed speech.`);
    assert(audio.longSilenceRms > audio.speechOneRms * 2.4, 'Exported music did not recover during the long voiceover silence.');
    assert(audio.longSilenceRms > audio.speechTwoRms * 2.4, 'Exported music did not duck again when voice activity resumed.');

    const disabled = await page.evaluate(() => window.__AIM_VIDEO_TEST__.setDuckingEnabled(false));
    assert(disabled.enabled === false, 'Ducking-disabled fixture did not update the music setting.');
    assert(Math.abs(disabled.speechGain - disabled.silenceGain) < 0.000001, 'Ducking-disabled preview retained speech-dependent gain.');
    await page.evaluate(() => window.__AIM_VIDEO_TEST__.setDuckingEnabled(true));

    const cancellation = await renderFixture('voiceover-mix-cancelled', {
      download: false,
      cancelAtStage: 'mixing-audio',
    });
    assert(cancellation.cancelled === true, 'Voiceover audio-mix cancellation did not return a controlled cancellation.');

    const replacement = await page.evaluate(() => window.__AIM_VIDEO_TEST__.replaceVoiceoverFixture());
    assert(replacement.sourceChanged && replacement.activeSegments === 1, 'Voiceover replacement did not invalidate and replace derived analysis.');
    const removed = await page.evaluate(() => window.__AIM_VIDEO_TEST__.removeVoiceoverFixture());
    assert(removed.removed && removed.envelopeRemoved, 'Voiceover removal did not remove its derived analysis.');

    await loadVoiceoverFixture();
    const damagedPreparation = await page.evaluate(() => window.__AIM_VIDEO_TEST__.prepareMissingEnvelopeDamagedReopen());
    await page.evaluate(async (imageAssetId) => {
      const database = await new Promise((resolve, reject) => {
        const request = indexedDB.open('aim-video-local-projects', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transaction = database.transaction('assets', 'readwrite');
      const store = transaction.objectStore('assets');
      const records = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const target = records.find((record) => record.assetId === imageAssetId);
      if (!target) throw new Error('No stored synthetic photograph was available to corrupt.');
      store.put({ ...target, blob: new Blob(['deliberately corrupt synthetic photograph']) });
      await new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      database.close();
    }, damagedPreparation.imageAssetId);
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await page.waitForFunction(() => window.__AIM_VIDEO_TEST__?.state().voiceActivitySegments === 2);
    await page.getByText(/failed its size or SHA-256 integrity check/i).waitFor();
    const damagedProjectReopen = {
      opened: await page.getByRole('heading', { name: 'Production settings' }).isVisible(),
      voiceActivitySegments: await page.evaluate(() => window.__AIM_VIDEO_TEST__.state().voiceActivitySegments),
      corruptPhotoVisible: true,
    };
    assert(damagedProjectReopen.opened, 'A damaged photograph prevented the project from opening after derived voice analysis was recalculated.');

    evidence.voiceover = {
      loaded,
      analysisPerformance,
      missingEnvelopeReopen,
      saveReopen,
      previewAppliedGains,
      beforeAnalysisMemory,
      afterAnalysisMemory,
      approximateFixtureLoadHeapDeltaBytes: beforeAnalysisMemory && afterAnalysisMemory
        ? Math.max(0, afterAnalysisMemory.usedJsHeapBytes - beforeAnalysisMemory.usedJsHeapBytes)
        : null,
      render: rendered,
      disabled,
      cancellation,
      replacement,
      removed,
      damagedProjectReopen,
    };
  } else if (mode === 'fixtures') {
    const loaded15 = await loadFixture(15, 'branded');
    const saveReopen = await page.evaluate(() => window.__AIM_VIDEO_TEST__.saveAndReopen());
    const replacement = await page.evaluate(() => window.__AIM_VIDEO_TEST__.replaceFirstShot());
    await page.waitForFunction(
      (expectedAssets) => window.__AIM_VIDEO_TEST__?.state().assets === expectedAssets,
      loaded15.assets + 1,
    );
    const retime = await page.evaluate(() => window.__AIM_VIDEO_TEST__.retimeFirstShot(2));
    await page.waitForFunction(() => window.__AIM_VIDEO_TEST__?.state().firstShot?.durationSec === 2);
    const branded15 = await renderFixture('fifteen-shot-branded-edited');
    assertAlphaProfile(branded15, 'Edited branded 15-shot output');
    assert(!branded15.error && branded15.parity.every((sample) => sample.withinLossyTolerance), branded15.error ?? 'Edited branded 15-shot parity failed.');

    await loadFixture(15, 'unbranded');
    const unbranded15 = await renderFixture('fifteen-shot-unbranded');
    assertAlphaProfile(unbranded15, 'Unbranded 15-shot output');
    assert(!unbranded15.error && unbranded15.inspection.width === 1920, unbranded15.error ?? 'Unbranded 15-shot render failed.');
    const unbrandedBytes = await readFile(unbranded15.path);
    assert(!unbrandedBytes.includes(Buffer.from('Real Estate AIM')), 'Unbranded MP4 contains embedded product-brand metadata.');

    await loadFixture(30, 'branded');
    const before30Memory = await memorySnapshot();
    const branded30 = await renderFixture('thirty-shot-branded');
    assertAlphaProfile(branded30, 'Branded 30-shot output');
    const after30Memory = await memorySnapshot();
    assert(!branded30.error && branded30.parity.every((sample) => sample.withinLossyTolerance), branded30.error ?? 'Thirty-shot render or parity failed.');

    await loadFixture(30, 'branded');
    const cancellation = await renderFixture('thirty-shot-cancelled', { download: false, cancelAtFrame: 12 });
    assert(cancellation.cancelled === true, 'Thirty-shot cancellation did not produce a controlled cancellation.');

    await loadFixture(30, 'branded');
    const missingAssetId = await page.evaluate(() => window.__AIM_VIDEO_TEST__.removeFirstRuntimeAsset());
    const controlledFailure = await renderFixture('thirty-shot-controlled-failure', { download: false });
    assert(controlledFailure.error?.includes('missing'), 'Missing local asset did not produce a controlled failure.');

    await loadFixture(6, 'branded');
    const finalizationCancellation = await renderFixture('canonical-finalization-cancelled', {
      download: false,
      cancelAtStage: 'finalizing',
    });
    assert(finalizationCancellation.cancelled === true, 'Finalization-stage cancellation returned a completed download.');

    evidence.fifteenShot = {
      saveReopen,
      replacement,
      retime,
      unbrandedMetadataNeutral: true,
      branded: branded15,
      unbranded: unbranded15,
    };
    evidence.thirtyShot = {
      render: branded30,
      beforeMemory: before30Memory,
      afterMemory: after30Memory,
      cancellation,
      controlledFailure,
      finalizationCancellation,
      missingAssetId,
    };
  } else {
    throw new Error(`Unknown browser verification mode: ${mode}`);
  }

  assert(consoleProblems.length === 0, `Browser console problems: ${consoleProblems.join(' | ')}`);
  await writeFile(path.join(outputRoot, `${mode}-evidence.json`), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  process.stdout.write(`VERIFICATION_EVIDENCE ${JSON.stringify(evidence)}\n`);
  await context.close();
} finally {
  if (browser) await browser.close();
  server?.kill('SIGTERM');
}
