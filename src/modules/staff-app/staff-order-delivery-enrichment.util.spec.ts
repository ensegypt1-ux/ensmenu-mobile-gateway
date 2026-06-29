import {
  applyDeliveryFields,
  extractDeliveryCustomerFields,
  isDeliveryLike,
  needsDeliveryDetailEnrichment,
} from './staff-order-delivery-enrichment.util';

describe('staff-order-delivery-enrichment.util', () => {
  it('reads nested order fields from activity-log detail shape', () => {
    const fields = extractDeliveryCustomerFields({
      order: {
        type: 'delivery',
        customerPhone: '01012345678',
        customerAddress: 'Near mall',
        orderNotes: 'Extra sauce',
        governorateNameEn: 'Tanta',
        deliveryFee: 25,
      },
    });

    expect(fields.customerPhone).toBe('01012345678');
    expect(fields.customerAddress).toBe('Near mall');
    expect(fields.orderNotes).toBe('Extra sauce');
    expect(fields.governorateNameEn).toBe('Tanta');
    expect(fields.deliveryFee).toBe(25);
  });

  it('detects delivery-like orders with empty table number and zone', () => {
    const entry = { tableNumber: '', type: 'table' };
    const fields = { governorateNameEn: 'Tanta', governorateId: null, customerPhone: null, customerAddress: null, orderNotes: null, governorateNameAr: null, deliveryFee: null, type: null };
    expect(isDeliveryLike(entry, fields)).toBe(true);
  });

  it('flags missing phone on delivery orders for detail enrichment', () => {
    expect(
      needsDeliveryDetailEnrichment({
        type: 'delivery',
        tableNumber: '',
        customerName: 'Guest',
      }),
    ).toBe(true);

    expect(
      needsDeliveryDetailEnrichment({
        type: 'delivery',
        customerPhone: '01012345678',
      }),
    ).toBe(false);
  });

  it('applyDeliveryFields prefers extracted non-empty values', () => {
    const merged = applyDeliveryFields(
      { type: 'delivery', customerPhone: null },
      {
        customerPhone: '01011112222',
        customerAddress: 'Street 1',
        orderNotes: 'Note',
        governorateNameEn: 'Tanta',
      },
    );

    expect(merged.customerPhone).toBe('01011112222');
    expect(merged.customerAddress).toBe('Street 1');
    expect(merged.orderNotes).toBe('Note');
    expect(merged.governorateNameEn).toBe('Tanta');
  });
});
