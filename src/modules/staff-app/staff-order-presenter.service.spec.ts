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

  it('enriches delivery fields from activity-log list for cashier', async () => {
    ensHttp.proxy
      .mockResolvedValueOnce({
        status: 200,
        data: {
          entries: [
            {
              id: '99',
              orderId: '519',
              type: 'delivery',
              customerName: 'asasas',
              customerPhone: '01012345678',
              customerAddress: 'Street 12',
              orderNotes: 'Ring bell',
              governorateNameAr: 'طنطا',
              governorateNameEn: 'Tanta',
              deliveryFee: 25,
              totalPrice: 200,
              items: [],
              actionDetails: [{ status: 'pending', time: '2026-06-21T12:00:00.000Z' }],
            },
          ],
          totalPages: 1,
        },
      })
      .mockResolvedValue({ status: 200, data: { entries: [], totalPages: 1 } });

    const result = await service.presentListPayload({} as never, {
      calls: [
        {
          id: 519,
          menuId: 1,
          tableNumber: '',
          status: 'pending',
          orderTotal: 200,
          at: '2026-06-21T12:00:00.000Z',
          customerName: 'asasas',
          items: [{ menuItemId: 1, quantity: 1, name: 'Item', price: 200 }],
        },
      ],
    });

    const entries = result.data.entries as Record<string, unknown>[];
    expect(result.enrichment).toBe('activity-log');
    expect(entries[0].customerPhone).toBe('01012345678');
    expect(entries[0].customerAddress).toBe('Street 12');
    expect(entries[0].orderNotes).toBe('Ring bell');
    expect(entries[0].governorateNameEn).toBe('Tanta');
  });

  it('falls back to staff-auth-only when activity logs are forbidden (waiter)', async () => {
    ensHttp.proxy.mockResolvedValue({ status: 404, data: null });

    const result = await service.presentListPayload({} as never, {
      calls: [
        {
          id: 519,
          menuId: 1,
          tableNumber: '',
          status: 'pending',
          orderTotal: 200,
          customerName: 'asasas',
          items: [],
        },
      ],
    });

    const entries = result.data.entries as Record<string, unknown>[];
    expect(result.enrichment).toBe('staff-auth-only');
    expect(entries[0].customerPhone == null).toBe(true);
    expect(entries[0].type).toBe('delivery');
  });

  it('backfills phone from activity-log detail when list row is incomplete', async () => {
    ensHttp.proxy.mockImplementation(async (opts: { path?: string }) => {
      if (String(opts.path).includes('/activity-logs/99')) {
        return {
          status: 200,
          data: {
            entry: {
              id: '99',
              orderId: '519',
              customerPhone: '01099998888',
              customerAddress: 'Building 3',
              orderNotes: 'Call on arrival',
              governorateNameEn: 'Tanta',
              order: {
                customerPhone: '01099998888',
                customerAddress: 'Building 3',
                orderNotes: 'Call on arrival',
                governorateNameEn: 'Tanta',
              },
              actions: [],
            },
          },
        };
      }
      return {
        status: 200,
        data: {
          entries: [
            {
              id: '99',
              orderId: '519',
              type: 'delivery',
              customerName: 'asasas',
              totalPrice: 200,
              items: [],
            },
          ],
          totalPages: 1,
        },
      };
    });

    const result = await service.presentOnePayload({} as never, {
      id: 519,
      menuId: 1,
      tableNumber: '',
      status: 'pending',
      orderTotal: 200,
      customerName: 'asasas',
      items: [],
    });

    const entry = result.data.entry as Record<string, unknown>;
    expect(result.enrichment).toBe('activity-log-detail');
    expect(entry.customerPhone).toBe('01099998888');
    expect(entry.customerAddress).toBe('Building 3');
    expect(entry.orderNotes).toBe('Call on arrival');
  });

  it('merges activity-log row by orderId for cashier list', async () => {
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
          totalPages: 1,
        },
      })
      .mockResolvedValue({ status: 200, data: { entries: [], totalPages: 1 } });

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

    const entry = (result.data.entries as Record<string, unknown>[])[0];
    expect(entry.id).toBe('99');
    expect(entry.orderId).toBe('480');
    expect(entry.orderNotes).toBe('From activity log');
  });
});
