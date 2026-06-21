import { Test, TestingModule } from '@nestjs/testing';
import { StaffOrderPresenterService } from './staff-order-presenter.service';
import { EnsHttpService } from '../../infrastructure/ens-backend/ens-http.service';

describe('StaffOrderPresenterService', () => {
  let service: StaffOrderPresenterService;
  let ensHttp: { proxy: jest.Mock };

  beforeEach(async () => {
    ensHttp = { proxy: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffOrderPresenterService,
        { provide: EnsHttpService, useValue: ensHttp },
      ],
    }).compile();
    service = module.get(StaffOrderPresenterService);
  });

  it('presents staff-auth only when activity logs forbidden', async () => {
    ensHttp.proxy.mockResolvedValue({ status: 403, data: null });

    const result = await service.presentListPayload({} as never, {
      calls: [
        {
          id: 480,
          menuId: 1,
          tableNumber: '1',
          status: 'pending',
          orderTotal: 12,
          at: '2026-06-21T12:00:00.000Z',
          customerName: 'saasasas',
          orderNotes: 'sasasasasasa',
          items: [{ menuItemId: 1, quantity: 1, name: 'Item', price: 12 }],
        },
      ],
    });

    const entries = result.entries as Record<string, unknown>[];
    expect(entries).toHaveLength(1);
    expect(entries[0].orderId).toBe('480');
    expect(entries[0].orderNotes).toBe('sasasasasasa');
    expect(entries[0].totalPrice).toBe(12);
  });

  it('merges activity-log row by orderId for cashier', async () => {
    ensHttp.proxy
      .mockResolvedValueOnce({
        status: 200,
        data: {
          entries: [
            {
              id: '99',
              orderId: '480',
              lastAction: 'TABLE_CALL_CREATED',
              actionDetails: [{ status: 'pending', time: '2026-06-21T12:00:00.000Z' }],
              orderNotes: 'From activity log',
              totalPrice: 12,
              items: [],
              type: 'table',
              tableNumber: '1',
            },
          ],
        },
      })
      .mockResolvedValueOnce({ status: 200, data: { entries: [] } });

    const result = await service.presentListPayload({} as never, {
      calls: [
        {
          id: 480,
          menuId: 1,
          tableNumber: '1',
          status: 'pending',
          orderTotal: 12,
          at: '2026-06-21T12:00:00.000Z',
          orderNotes: null,
          items: [],
        },
      ],
    });

    const entry = (result.entries as Record<string, unknown>[])[0];
    expect(entry.id).toBe('99');
    expect(entry.orderId).toBe('480');
    expect(entry.orderNotes).toBe('From activity log');
  });
});
