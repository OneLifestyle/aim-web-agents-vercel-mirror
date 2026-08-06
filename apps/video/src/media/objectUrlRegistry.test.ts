import { describe, expect, it, vi } from 'vitest';
import { ObjectUrlRegistry } from './objectUrlRegistry';

describe('ObjectUrlRegistry', () => {
  it('revokes replaced, removed and cleared URLs exactly once', () => {
    const revoke = vi.fn();
    let counter = 0;
    const registry = new ObjectUrlRegistry(() => `blob:test-${counter++}`, revoke);
    registry.set('asset', new Blob(['one']));
    registry.set('asset', new Blob(['two']));
    registry.set('other', new Blob(['three']));
    expect(revoke).toHaveBeenCalledWith('blob:test-0');
    registry.delete('asset');
    registry.clear();
    expect(revoke.mock.calls.map(([url]) => url)).toEqual([
      'blob:test-0',
      'blob:test-1',
      'blob:test-2',
    ]);
    expect(registry.size).toBe(0);
  });
});
