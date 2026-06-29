type JsonRecord = Record<string, unknown>;

/** How delivery customer fields were resolved for staff order responses. */
export type StaffOrderEnrichmentSource =
  | 'activity-log'
  | 'activity-log-detail'
  | 'staff-auth-only';

export type DeliveryCustomerFields = {
  type: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  orderNotes: string | null;
  governorateId: number | null;
  governorateNameAr: string | null;
  governorateNameEn: string | null;
  deliveryFee: number | null;
};

export function hasText(value: unknown): boolean {
  return value != null && String(value).trim().length > 0;
}

export function firstText(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (hasText(c)) return String(c).trim();
  }
  return null;
}

export function firstNumber(...candidates: unknown[]): number | null {
  for (const c of candidates) {
    if (c == null || c === '') continue;
    const n = Number(c);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function nestedOrder(record: JsonRecord | undefined | null): JsonRecord | null {
  if (!record) return null;
  const order = record.order;
  return order != null && typeof order === 'object' ? (order as JsonRecord) : null;
}

/** Read delivery customer fields from activity-log list/detail or staff-auth call rows. */
export function extractDeliveryCustomerFields(
  ...sources: Array<JsonRecord | undefined | null>
): DeliveryCustomerFields {
  const phone: unknown[] = [];
  const address: unknown[] = [];
  const notes: unknown[] = [];
  const typeCandidates: unknown[] = [];
  const governorateIds: unknown[] = [];
  const governorateNamesAr: unknown[] = [];
  const governorateNamesEn: unknown[] = [];
  const fees: unknown[] = [];

  for (const source of sources) {
    if (!source) continue;
    const order = nestedOrder(source);

    phone.push(source.customerPhone, order?.customerPhone);
    address.push(source.customerAddress, order?.customerAddress);
    notes.push(
      source.orderNotes,
      order?.orderNotes,
      source.deliveryNotes,
      order?.deliveryNotes,
    );
    typeCandidates.push(
      source.type,
      order?.type,
      source.orderType,
      order?.orderType,
    );
    governorateIds.push(source.governorateId, order?.governorateId);
    governorateNamesAr.push(source.governorateNameAr, order?.governorateNameAr);
    governorateNamesEn.push(source.governorateNameEn, order?.governorateNameEn);
    fees.push(source.deliveryFee, order?.deliveryFee);
  }

  return {
    type: firstText(...typeCandidates),
    customerPhone: firstText(...phone),
    customerAddress: firstText(...address),
    orderNotes: firstText(...notes),
    governorateId: firstNumber(...governorateIds),
    governorateNameAr: firstText(...governorateNamesAr),
    governorateNameEn: firstText(...governorateNamesEn),
    deliveryFee: firstNumber(...fees),
  };
}

export function isDeliveryLike(
  entry: JsonRecord,
  fields?: DeliveryCustomerFields,
): boolean {
  const type = firstText(entry.type, fields?.type)?.toLowerCase();
  if (type === 'delivery') return true;
  const table = String(entry.tableNumber ?? '')
    .trim()
    .toLowerCase();
  if (table === 'delivery') return true;
  if (
    table === '' &&
    (fields?.governorateId != null ||
      hasText(fields?.governorateNameAr) ||
      hasText(fields?.governorateNameEn) ||
      hasText(fields?.customerAddress))
  ) {
    return true;
  }
  return false;
}

/** True when a delivery order still needs activity-log detail backfill. */
export function needsDeliveryDetailEnrichment(entry: JsonRecord): boolean {
  const fields = extractDeliveryCustomerFields(entry);
  if (!isDeliveryLike(entry, fields)) return false;
  return !hasText(fields.customerPhone);
}

export function applyDeliveryFields(
  entry: JsonRecord,
  ...sources: Array<JsonRecord | undefined | null>
): JsonRecord {
  const extracted = extractDeliveryCustomerFields(entry, ...sources);
  const merged: JsonRecord = { ...entry };

  if (hasText(extracted.type)) merged.type = extracted.type;
  if (hasText(extracted.customerPhone)) merged.customerPhone = extracted.customerPhone;
  if (hasText(extracted.customerAddress)) {
    merged.customerAddress = extracted.customerAddress;
  }
  if (hasText(extracted.orderNotes)) merged.orderNotes = extracted.orderNotes;
  if (extracted.governorateId != null) merged.governorateId = extracted.governorateId;
  if (hasText(extracted.governorateNameAr)) {
    merged.governorateNameAr = extracted.governorateNameAr;
  }
  if (hasText(extracted.governorateNameEn)) {
    merged.governorateNameEn = extracted.governorateNameEn;
  }
  if (extracted.deliveryFee != null) merged.deliveryFee = extracted.deliveryFee;

  return merged;
}

export function resolveOrderType(call: JsonRecord): string {
  const fields = extractDeliveryCustomerFields(call);
  const type = fields.type?.toLowerCase();
  if (type === 'delivery' || type === 'table') return type;
  const table = String(call.tableNumber ?? '')
    .trim()
    .toLowerCase();
  if (table === 'delivery') return 'delivery';
  // Express stores delivery orders with empty tableNumber.
  if (table === '') return 'delivery';
  if (isDeliveryLike(call, fields)) return 'delivery';
  return 'table';
}

export function activityLogIdFromRow(row: JsonRecord | undefined): number | null {
  if (!row) return null;
  const activityLogId = Number(row.id);
  const staffCallId = Number(row.orderId);
  if (!Number.isFinite(activityLogId) || activityLogId <= 0) return null;
  if (
    Number.isFinite(staffCallId) &&
    staffCallId > 0 &&
    String(activityLogId) === String(staffCallId)
  ) {
    return null;
  }
  return activityLogId;
}
