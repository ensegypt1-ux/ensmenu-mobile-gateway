import { resolveOrderType } from './staff-order-delivery-enrichment.util';

type JsonRecord = Record<string, unknown>;

export type StaffMobileQueuePhase =
  | 'needs_review'
  | 'with_cashier'
  | 'in_progress'
  | 'done'
  | 'cashier_pending';

export type StaffOrderSubmissionView = {
  submittedToCashierAt: string | null;
  submittedByStaffId: number | null;
  submittedByStaffName: string | null;
  mobileQueuePhase: StaffMobileQueuePhase;
  requiresWaiterSubmission: boolean;
};

const TERMINAL = new Set(['delivered', 'cancelled']);
const ACTIVE_PROGRESS = new Set(['confirmed', 'prepared']);

export function resolveLifecycleStatus(row: JsonRecord): string {
  const order =
    row.order && typeof row.order === 'object'
      ? (row.order as JsonRecord)
      : null;
  const direct = String(row.status ?? order?.status ?? '')
    .trim()
    .toLowerCase();
  if (
    direct === 'pending' ||
    direct === 'confirmed' ||
    direct === 'prepared' ||
    direct === 'delivered' ||
    direct === 'cancelled'
  ) {
    return direct;
  }

  const details = row.actionDetails;
  if (Array.isArray(details) && details.length > 0) {
    for (let i = details.length - 1; i >= 0; i--) {
      const act = details[i];
      if (!act || typeof act !== 'object') continue;
      const status = String((act as JsonRecord).status ?? '')
        .trim()
        .toLowerCase();
      const mapped = mapTimelineStatus(status);
      if (mapped) return mapped;
    }
  }

  const lastAction = String(row.lastAction ?? '')
    .trim()
    .toUpperCase();
  return mapActionToStatus(lastAction) ?? 'pending';
}

function mapTimelineStatus(raw: string): string | null {
  switch (raw) {
    case 'confirmed':
    case 'table_call_confirmed':
      return 'confirmed';
    case 'prepared':
    case 'table_call_prepared':
      return 'prepared';
    case 'delivered':
    case 'table_call_delivered':
      return 'delivered';
    case 'cancelled':
    case 'table_call_cancelled':
      return 'cancelled';
    case 'pending':
    case 'table_call_created':
      return 'pending';
    default:
      return null;
  }
}

function mapActionToStatus(action: string): string | null {
  switch (action) {
    case 'TABLE_CALL_CONFIRMED':
      return 'confirmed';
    case 'TABLE_CALL_PREPARED':
      return 'prepared';
    case 'TABLE_CALL_DELIVERED':
      return 'delivered';
    case 'TABLE_CALL_CANCELLED':
      return 'cancelled';
    case 'TABLE_CALL_CREATED':
      return 'pending';
    default:
      return null;
  }
}

/** Table food orders (not empty assistance bells) require waiter submit before cashier. */
export function requiresWaiterSubmission(row: JsonRecord): boolean {
  if (resolveOrderType(row) === 'delivery') return false;
  const items = Array.isArray(row.items) ? row.items : [];
  const total = Number(row.totalPrice ?? row.orderTotal ?? 0);
  if (items.length === 0 && !(Number.isFinite(total) && total > 0)) {
    return false;
  }
  return resolveLifecycleStatus(row) === 'pending';
}

export function buildSubmissionView(
  row: JsonRecord,
  submission: {
    submittedAt: string;
    submittedByStaffId: number;
    submittedByStaffName?: string;
  } | null,
): StaffOrderSubmissionView {
  const status = resolveLifecycleStatus(row);
  const gated = requiresWaiterSubmission(row);
  const submittedAt = submission?.submittedAt ?? null;
  const isSubmitted = submittedAt != null;

  let mobileQueuePhase: StaffMobileQueuePhase;
  if (TERMINAL.has(status)) {
    mobileQueuePhase = 'done';
  } else if (ACTIVE_PROGRESS.has(status)) {
    mobileQueuePhase = 'in_progress';
  } else if (status === 'pending' && gated && !isSubmitted) {
    mobileQueuePhase = 'needs_review';
  } else if (status === 'pending' && gated && isSubmitted) {
    mobileQueuePhase = 'with_cashier';
  } else if (status === 'pending') {
    mobileQueuePhase = 'cashier_pending';
  } else {
    mobileQueuePhase = 'in_progress';
  }

  return {
    submittedToCashierAt: submittedAt,
    submittedByStaffId: submission?.submittedByStaffId ?? null,
    submittedByStaffName: submission?.submittedByStaffName ?? null,
    mobileQueuePhase,
    requiresWaiterSubmission: gated,
  };
}

export function enrichRowWithSubmission(
  row: JsonRecord,
  submission: {
    submittedAt: string;
    submittedByStaffId: number;
    submittedByStaffName?: string;
  } | null,
): JsonRecord {
  const view = buildSubmissionView(row, submission);
  return {
    ...row,
    submittedToCashierAt: view.submittedToCashierAt,
    submittedByStaffId: view.submittedByStaffId,
    submittedByStaffName: view.submittedByStaffName,
    mobileQueuePhase: view.mobileQueuePhase,
    requiresWaiterSubmission: view.requiresWaiterSubmission,
  };
}

export function isTodayIso(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return false;
  const date = new Date(parsed);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function rowTimestamp(row: JsonRecord): string | null {
  const candidates = [
    row.updatedAt,
    row.at,
    row.requestedAt,
    row.createdAt,
  ];
  for (const value of candidates) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  const details = row.actionDetails;
  if (Array.isArray(details) && details.length > 0) {
    const last = details[details.length - 1];
    if (last && typeof last === 'object') {
      const time = String((last as JsonRecord).time ?? '').trim();
      if (time) return time;
    }
  }
  return null;
}

export type StaffQueueFilter =
  | 'waiter_needs_review'
  | 'waiter_with_cashier'
  | 'waiter_in_progress'
  | 'waiter_done_today';

export function parseStaffQueueFilter(
  raw: unknown,
): StaffQueueFilter | null {
  const value = String(raw ?? '').trim().toLowerCase();
  switch (value) {
    case 'waiter_needs_review':
      return 'waiter_needs_review';
    case 'waiter_with_cashier':
      return 'waiter_with_cashier';
    case 'waiter_in_progress':
      return 'waiter_in_progress';
    case 'waiter_done_today':
      return 'waiter_done_today';
    default:
      return null;
  }
}

export function matchesStaffQueueFilter(
  row: JsonRecord,
  filter: StaffQueueFilter,
): boolean {
  const phase = String(row.mobileQueuePhase ?? '');
  switch (filter) {
    case 'waiter_needs_review':
      return phase === 'needs_review';
    case 'waiter_with_cashier':
      return phase === 'with_cashier';
    case 'waiter_in_progress':
      return phase === 'in_progress';
    case 'waiter_done_today':
      return (
        phase === 'done' && isTodayIso(rowTimestamp(row))
      );
    default:
      return false;
  }
}

/** Cashier active list: hide unsubmitted gated pending table orders. */
export function visibleToCashierActive(row: JsonRecord): boolean {
  const phase = String(row.mobileQueuePhase ?? '');
  if (phase === 'needs_review') return false;
  if (phase === 'done') return false;
  return true;
}

export function cashierCanActOnPending(row: JsonRecord): boolean {
  const status = resolveLifecycleStatus(row);
  if (status !== 'pending') return true;
  if (!requiresWaiterSubmission(row)) return true;
  return row.submittedToCashierAt != null;
}
