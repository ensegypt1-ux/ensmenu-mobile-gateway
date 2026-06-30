import { normalizeStaffUpstreamError } from './staff-order-errors.util';

describe('normalizeStaffUpstreamError', () => {
  it('maps not editable upstream errors', () => {
    const result = normalizeStaffUpstreamError({
      status: 409,
      data: { error: 'Table call is not editable' },
    });

    expect(result.data).toEqual(
      expect.objectContaining({ code: 'STAFF_ITEMS_NOT_EDITABLE' }),
    );
  });

  it('maps order state errors', () => {
    const result = normalizeStaffUpstreamError({
      status: 409,
      data: { error: 'Call not found or not pending' },
    });

    expect(result.data).toEqual(
      expect.objectContaining({ code: 'STAFF_ORDER_STATE_CHANGED' }),
    );
  });

  it('passes through known mobile codes', () => {
    const payload = {
      status: 403,
      data: {
        error: 'Denied',
        code: 'STAFF_ACTION_DENIED',
      },
    };
    expect(normalizeStaffUpstreamError(payload)).toBe(payload);
  });
});
