import {
  buildSubmissionView,
  matchesStaffQueueFilter,
  requiresWaiterSubmission,
  resolveLifecycleStatus,
  visibleToCashierActive,
} from './staff-order-gate.util';

describe('staff-order-gate.util', () => {
  it('requires submission for table orders with items', () => {
    expect(
      requiresWaiterSubmission({
        type: 'table',
        status: 'pending',
        items: [{ name: 'Burger', quantity: 1 }],
      }),
    ).toBe(true);
  });

  it('skips submission for empty assistance calls', () => {
    expect(
      requiresWaiterSubmission({
        type: 'table',
        status: 'pending',
        items: [],
        totalPrice: 0,
      }),
    ).toBe(false);
  });

  it('maps needs_review vs with_cashier', () => {
    const row = {
      type: 'table',
      status: 'pending',
      items: [{ name: 'Tea', quantity: 1 }],
    };
    const review = buildSubmissionView(row, null);
    expect(review.mobileQueuePhase).toBe('needs_review');

    const waiting = buildSubmissionView(row, {
      submittedAt: new Date().toISOString(),
      submittedByStaffId: 7,
    });
    expect(waiting.mobileQueuePhase).toBe('with_cashier');
  });

  it('hides needs_review from cashier active list', () => {
    const row = {
      mobileQueuePhase: 'needs_review',
    };
    expect(visibleToCashierActive(row)).toBe(false);
  });

  it('filters waiter queue tabs', () => {
    const row = { mobileQueuePhase: 'with_cashier' };
    expect(matchesStaffQueueFilter(row, 'waiter_with_cashier')).toBe(true);
    expect(matchesStaffQueueFilter(row, 'waiter_needs_review')).toBe(false);
  });

  it('resolves confirmed from last action', () => {
    expect(
      resolveLifecycleStatus({
        lastAction: 'TABLE_CALL_CONFIRMED',
        actionDetails: [],
      }),
    ).toBe('confirmed');
  });
});
