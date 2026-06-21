import { StaffOrderEnrichmentService } from './staff-order-enrichment.service';

describe('StaffOrderEnrichmentService', () => {
  const ensHttp = {
    proxy: jest.fn(),
  };

  let service: StaffOrderEnrichmentService;

  beforeEach(() => {
    ensHttp.proxy.mockReset();
    service = new StaffOrderEnrichmentService(ensHttp as never);
  });

  it('merges delivery customer fields from activity logs when staff call lacks them', async () => {
    ensHttp.proxy.mockResolvedValue({
      status: 200,
      data: {
        entries: [
          {
            orderId: '42',
            customerPhone: '0790111222',
            customerAddress: 'Main Street 5',
            orderNotes: 'Call on arrival',
            governorateNameEn: 'Amman',
            deliveryFee: 2.5,
          },
        ],
      },
    });

    const payload = {
      calls: [
        {
          id: 42,
          menuId: 7,
          type: 'delivery',
          customerName: 'Ali',
          customerPhone: null,
          customerAddress: null,
          orderNotes: null,
          governorateNameEn: null,
          deliveryFee: null,
        },
      ],
    } as { calls: Array<Record<string, unknown>> };

    const result = await service.enrichOrderPayload({} as never, payload);

    expect(result.outcome).toBe('success');
    expect(result.enriched).toBe(1);
    expect(payload.calls[0].customerPhone).toBe('0790111222');
    expect(payload.calls[0].customerAddress).toBe('Main Street 5');
    expect(payload.calls[0].orderNotes).toBe('Call on arrival');
    expect(payload.calls[0].governorateNameEn).toBe('Amman');
    expect(payload.calls[0].deliveryFee).toBe(2.5);
  });

  it('returns forbidden outcome without mutating calls when activity logs are 403', async () => {
    ensHttp.proxy.mockResolvedValue({
      status: 403,
      data: { error: 'Forbidden' },
    });

    const payload = {
      calls: [
        {
          id: 1,
          menuId: 7,
          type: 'delivery',
          customerPhone: null,
        },
      ],
    } as { calls: Array<Record<string, unknown>> };

    const result = await service.enrichOrderPayload({} as never, payload);

    expect(result.outcome).toBe('forbidden');
    expect(result.enriched).toBe(0);
    expect(payload.calls[0].customerPhone).toBeNull();
  });

  it('skips enrichment when delivery call already has contact fields', async () => {
    const payload = {
      calls: [
        {
          id: 1,
          menuId: 7,
          type: 'delivery',
          customerName: 'Sara',
          customerPhone: '0790000000',
          customerAddress: 'Known address',
          orderNotes: 'Done',
          governorateNameEn: 'Zarqa',
          deliveryFee: 1,
        },
      ],
    };

    const result = await service.enrichOrderPayload({} as never, payload);

    expect(result.outcome).toBe('skipped');
    expect(ensHttp.proxy).not.toHaveBeenCalled();
  });

  it('enriches single-order detail payload', async () => {
    ensHttp.proxy.mockResolvedValue({
      status: 200,
      data: {
        entries: [{ orderId: '9', customerPhone: '0781111111' }],
      },
    });

    const order = {
      id: 9,
      menuId: 3,
      type: 'delivery',
      customerPhone: null,
    } as Record<string, unknown>;

    const result = await service.enrichOrderPayload({} as never, order);

    expect(result.outcome).toBe('success');
    expect(order.customerPhone).toBe('0781111111');
  });
});
