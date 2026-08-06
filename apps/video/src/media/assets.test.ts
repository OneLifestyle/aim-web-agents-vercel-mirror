import { describe, expect, it } from 'vitest';
import { createOperatorConfirmedRights, operatorRightsAreComplete } from './assets';

describe('operator media-rights records', () => {
  it('records actual supplied provenance plus a separate confirmation time', () => {
    const input = {
      source: 'Vendor supplied via campaign folder',
      owner: 'Example Property Photography Pty Ltd',
      licenceOrPermission: 'Written campaign licence dated 2026-08-01',
    };
    expect(operatorRightsAreComplete(input)).toBe(true);
    expect(createOperatorConfirmedRights(
      'This client property video and local exports',
      input,
      '2026-08-06T00:00:00.000Z',
    )).toEqual({
      ...input,
      permittedUse: 'This client property video and local exports',
      confirmedAt: '2026-08-06T00:00:00.000Z',
    });
  });

  it('rejects blank placeholder-free provenance', () => {
    const incomplete = { source: '', owner: 'Vendor', licenceOrPermission: '' };
    expect(operatorRightsAreComplete(incomplete)).toBe(false);
    expect(() => createOperatorConfirmedRights('Client video', incomplete)).toThrow(/source/i);
  });
});
