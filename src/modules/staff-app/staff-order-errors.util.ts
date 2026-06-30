import { EnsHttpResult } from '../../infrastructure/ens-backend/ens-http.service';

type NormalizedStaffError = {
  status: number;
  data: {
    error: string;
    errorAr?: string;
    code: string;
  };
};

const NOT_EDITABLE_MARKERS = [
  'not editable',
  'tablecallnoteditable',
  'not_editable',
];

const NOT_PENDING_MARKERS = [
  'not pending',
  'not found or not pending',
  'callnotfoundornotpending',
];

export function normalizeStaffUpstreamError(
  result: EnsHttpResult,
): EnsHttpResult {
  if (result.status < 400) return result;

  const data = result.data;
  if (!data || typeof data !== 'object') {
    return result;
  }

  const body = data as Record<string, unknown>;
  const code = String(body.code ?? '').trim();
  const message = String(body.error ?? body.message ?? '')
    .trim()
    .toLowerCase();
  const messageAr = String(body.errorAr ?? '').trim();

  if (code === 'PRO_REQUIRED' || message.includes('pro')) {
    return {
      status: result.status,
      data: {
        error: 'Table orders require an active Pro plan',
        errorAr: 'طلبات الطاولات تتطلب خطة Pro نشطة',
        code: 'STAFF_PRO_REQUIRED',
      },
    };
  }

  if (
    code === 'STAFF_ACTION_DENIED' ||
    code === 'STAFF_DELIVERY_DENIED' ||
    code === 'ORDER_NOT_FOUND' ||
    code === 'INVALID_ORDER' ||
    code === 'STAFF_ITEMS_NOT_EDITABLE'
  ) {
    return result;
  }

  if (NOT_EDITABLE_MARKERS.some((marker) => message.includes(marker))) {
    return {
      status: 409,
      data: {
        error: 'Order items cannot be edited in the current status',
        errorAr: 'لا يمكن تعديل أصناف الطلب في هذه الحالة',
        code: 'STAFF_ITEMS_NOT_EDITABLE',
      },
    };
  }

  if (NOT_PENDING_MARKERS.some((marker) => message.includes(marker))) {
    return {
      status: 409,
      data: {
        error: 'This order action is no longer available',
        errorAr: 'هذا الإجراء لم يعد متاحاً على الطلب',
        code: 'STAFF_ORDER_STATE_CHANGED',
      },
    };
  }

  if (result.status === 404) {
    return {
      status: 404,
      data: {
        error: 'Order not found',
        errorAr: 'الطلب غير موجود',
        code: 'ORDER_NOT_FOUND',
      },
    };
  }

  if (messageAr) {
    return result;
  }

  return result;
}

export function deniedOrderResult(
  httpStatus: number,
  payload: NormalizedStaffError['data'],
): NormalizedStaffError {
  return { status: httpStatus, data: payload };
}
