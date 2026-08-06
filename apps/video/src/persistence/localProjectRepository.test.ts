import { describe, expect, it } from 'vitest';
import { createLocalAssetStorageKey } from './localProjectRepository';

describe('local project storage keys', () => {
  it('cannot collide when project and blob IDs contain separators', () => {
    expect(createLocalAssetStorageKey('a:b', 'c')).not.toBe(
      createLocalAssetStorageKey('a', 'b:c'),
    );
  });
});
