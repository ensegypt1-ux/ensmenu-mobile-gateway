import { availableActionsForOrder } from './staff-order-actions.util';
import { resolveListEntryStatus } from './staff-order-status.util';
import { StaffOrderPresenterService } from './staff-order-presenter.service';

describe('Staff order presenter', () => {
  const presenter = new StaffOrderPresenterService();

  it('presents cashier actions for confirmed orders', () => {
    const entry = presenter.presentListRow(
      {
        id: '10',
        orderId: '55',
        type: 'table',
        tableNumber: '3',
        totalPrice: 120,
        items: [{ name: 'Burger', quantity: 2, price: 60, total: 120 }],
        actionDetails: [{ status: 'confirmed', time: '2026-01-01T10:00:00Z' }],
      },
      'cashier',
      'table',
    );

    expect(entry).not.toBeNull();
    expect(entry!.availableActions.map((a) => a.action)).toEqual([
      'TABLE_CALL_PREPARED',
    ]);
  });

  it('limits waiter to accept/reject on pending only', () => {
    const entry = presenter.presentListRow(
      {
        id: '11',
        orderId: '56',
        type: 'table',
        tableNumber: '4',
        totalPrice: 80,
        items: [{ name: 'Tea', quantity: 1, price: 80, total: 80 }],
        actionDetails: [{ status: 'pending', time: '2026-01-01T10:00:00Z' }],
      },
      'waiter',
      'table',
    );

    expect(entry!.availableActions.map((a) => a.action)).toEqual([
      'TABLE_CALL_CONFIRMED',
      'TABLE_CALL_CANCELLED',
    ]);
  });

  it('resolves list status from action details', () => {
    const status = resolveListEntryStatus({
      actionDetails: [{ status: 'prepared' }],
    });
    expect(status).toBe('prepared');
    expect(availableActionsForOrder(status, 'cashier')).toEqual([
      expect.objectContaining({ action: 'TABLE_CALL_DELIVERED' }),
    ]);
  });
});
