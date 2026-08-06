import {
  VIDEO_PROJECT_VERSION,
  VideoProjectSchema,
  type VideoProject,
  type VideoProjectVersion,
} from './schemas';

export class UnsupportedVideoProjectVersionError extends Error {
  readonly foundVersion: unknown;
  readonly supportedVersions: readonly VideoProjectVersion[];

  constructor(foundVersion: unknown) {
    super(
      `Unsupported local video project version: ${String(foundVersion)}. ` +
        `This client supports ${VIDEO_PROJECT_VERSION}.`,
    );
    this.name = 'UnsupportedVideoProjectVersionError';
    this.foundVersion = foundVersion;
    this.supportedVersions = [VIDEO_PROJECT_VERSION];
  }
}

const readVersion = (input: unknown): unknown => {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return undefined;
  }

  return (input as Record<string, unknown>).version;
};

/**
 * Version-aware local manifest boundary. Version 1.0.0 is the first format, so
 * there is intentionally no legacy migration yet; unknown versions are rejected.
 */
export const migrateVideoProject = (input: unknown): VideoProject => {
  const version = readVersion(input);

  if (version !== undefined && version !== VIDEO_PROJECT_VERSION) {
    throw new UnsupportedVideoProjectVersionError(version);
  }

  return VideoProjectSchema.parse(input);
};

export const parseVideoProject = migrateVideoProject;
