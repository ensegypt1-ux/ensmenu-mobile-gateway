import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { EnsHttpService } from '../../infrastructure/ens-backend/ens-http.service';

type JsonRecord = Record<string, unknown>;

/**
 * BFF presenter: staff-auth table-calls + activity-logs → web `CallEntry` shape.
 * Join: activityLog.orderId === staffTableCall.id
 *
 * Cashier/casher: activity-log rows when available (403 → staff-auth only).
 * Waiter: staff-auth only, synthesized actionDetails from status.
 */
@Injectable()
export class StaffOrderPresenterService {
  private readonly logger = new Logger(StaffOrderPresenterService.name);

  constructor(private readonly ensHttp: EnsHttpService) {}

  async presentListPayload(
    req: Request,
    staffData: unknown,
  ): Promise<JsonRecord> {
    if (!staffData || typeof staffData !== 'object') {
      return staffData as JsonRecord;
    }

    const root = staffData as JsonRecord;
    const calls = this.extractStaffCalls(root);
    if (calls.length === 0) {
      return { ...root, entries: [] };
    }

    const menuId = this.resolveMenuId(calls);
    const activityByStaffCallId =
      menuId != null
        ? await this.fetchActivityIndex(req, menuId)
        : new Map<number, JsonRecord>();

    const entries = calls.map((call) =>
      this.presentCall(call, activityByStaffCallId.get(Number(call.id))),
    );

    return { ...root, entries, calls };
  }

  async presentOnePayload(
    req: Request,
    staffData: unknown,
  ): Promise<JsonRecord> {
    if (!staffData || typeof staffData !== 'object') {
      return staffData as JsonRecord;
    }

    const staffCall = staffData as JsonRecord;
    const menuId = Number(staffCall.menuId);
    const staffCallId = Number(staffCall.id);

    if (!Number.isFinite(menuId) || menuId <= 0 || !Number.isFinite(staffCallId)) {
      return { entry: this.staffCallToEntry(staffCall) };
    }

    const activityByStaffCallId = await this.fetchActivityIndex(req, menuId);
    const listEntry = this.presentCall(
      staffCall,
      activityByStaffCallId.get(staffCallId),
    );

    const activityLogId = Number(listEntry.id);
    if (
      Number.isFinite(activityLogId) &&
      activityLogId > 0 &&
      String(listEntry.id) !== String(listEntry.orderId)
    ) {
      const detail = await this.ensHttp.proxy({
        method: 'GET',
        path: `menus/${menuId}/activity-logs/${activityLogId}`,
        req,
      });

      if (detail.status >= 200 && detail.status < 300 && detail.data) {
        const body = detail.data as JsonRecord;
        const rawEntry = (body.entry ?? body) as JsonRecord;
        const entry = this.presentDetail(rawEntry, staffCall, listEntry);
        return { entry, ...staffCall, entries: [entry] };
      }
    }

    const entry = listEntry;
    return { entry, ...staffCall, entries: [entry] };
  }

  private presentDetail(
    detail: JsonRecord,
    staffCall: JsonRecord,
    listEntry: JsonRecord,
  ): JsonRecord {
    const order =
      detail.order && typeof detail.order === 'object'
        ? (detail.order as JsonRecord)
        : null;
    const actions = Array.isArray(detail.actions) ? detail.actions : [];

    const actionDetails = actions.map((a) => {
      if (!a || typeof a !== 'object') return a;
      const act = a as JsonRecord;
      return {
        waiterName: act.waiterName ?? '',
        time: act.time ?? '',
        status: act.status ?? '',
      };
    });

    const merged: JsonRecord = {
      ...listEntry,
      ...detail,
      orderId: String(staffCall.id ?? listEntry.orderId),
      items:
        Array.isArray(staffCall.items) && (staffCall.items as unknown[]).length
          ? staffCall.items
          : (listEntry.items ?? detail.items ?? order?.items ?? []),
      totalPrice:
        staffCall.orderTotal ??
        listEntry.totalPrice ??
        detail.totalPrice ??
        order?.orderTotal ??
        0,
      actionDetails:
        actionDetails.length > 0
          ? actionDetails
          : (listEntry.actionDetails ?? []),
      orderNotes:
        this.firstText(
          order?.orderNotes,
          detail.orderNotes,
          listEntry.orderNotes,
          staffCall.orderNotes,
        ) ?? null,
      customerName:
        this.firstText(
          order?.customerName,
          detail.customerName,
          listEntry.customerName,
          staffCall.customerName,
        ) ?? null,
      customerPhone:
        this.firstText(
          order?.customerPhone,
          detail.customerPhone,
          listEntry.customerPhone,
          staffCall.customerPhone,
        ) ?? null,
      customerAddress:
        this.firstText(
          order?.customerAddress,
          detail.customerAddress,
          listEntry.customerAddress,
          staffCall.customerAddress,
        ) ?? null,
    };

    if (order) {
      merged.order = order;
    }

    return merged;
  }

  private presentCall(
    staffCall: JsonRecord,
    activity: JsonRecord | undefined,
  ): JsonRecord {
    if (!activity) {
      return this.staffCallToEntry(staffCall);
    }

    const merged: JsonRecord = { ...activity };
    merged.orderId = String(staffCall.id ?? activity.orderId ?? '');

    if (Array.isArray(staffCall.items) && staffCall.items.length) {
      merged.items = staffCall.items;
    }
    if (staffCall.orderTotal != null) {
      merged.totalPrice = staffCall.orderTotal;
    }

    for (const key of [
      'orderNotes',
      'customerName',
      'customerPhone',
      'customerAddress',
      'governorateNameAr',
      'governorateNameEn',
    ] as const) {
      if (!this.hasText(merged[key]) && this.hasText(staffCall[key])) {
        merged[key] = staffCall[key];
      }
    }

    if (merged.governorateId == null && staffCall.governorateId != null) {
      merged.governorateId = staffCall.governorateId;
    }
    if (merged.deliveryFee == null && staffCall.deliveryFee != null) {
      merged.deliveryFee = staffCall.deliveryFee;
    }
    if (!this.hasText(merged.type) && this.hasText(staffCall.type)) {
      merged.type = staffCall.type;
    }
    if (!this.hasText(merged.tableNumber) && staffCall.tableNumber != null) {
      merged.tableNumber = staffCall.tableNumber;
    }

    return merged;
  }

  /** Web list row shape from staff-auth when activity-log is unavailable. */
  private staffCallToEntry(call: JsonRecord): JsonRecord {
    const id = String(call.id ?? '');
    const at = String(call.at ?? call.requestedAt ?? call.createdAt ?? '');
    const status = String(call.status ?? 'pending')
      .trim()
      .toLowerCase();
    const items = Array.isArray(call.items) ? call.items : [];
    const type = this.resolveOrderType(call);

    return {
      id,
      orderId: id,
      lastAction:
        status === 'pending'
          ? 'TABLE_CALL_CREATED'
          : `TABLE_CALL_${status.toUpperCase()}`,
      actionDetails: [{ status, time: at, waiterName: '' }],
      customerName: call.customerName ?? null,
      tableNumber: call.tableNumber ?? null,
      type,
      customerPhone: call.customerPhone ?? null,
      customerAddress: call.customerAddress ?? null,
      orderNotes: call.orderNotes ?? null,
      governorateId: call.governorateId ?? null,
      governorateNameAr: call.governorateNameAr ?? null,
      governorateNameEn: call.governorateNameEn ?? null,
      deliveryFee: call.deliveryFee ?? null,
      items,
      totalPrice: call.orderTotal ?? 0,
    };
  }

  private resolveOrderType(call: JsonRecord): string {
    const type = String(call.type ?? '')
      .trim()
      .toLowerCase();
    if (type === 'delivery' || type === 'table') return type;
    const table = String(call.tableNumber ?? '')
      .trim()
      .toLowerCase();
    if (table === 'delivery') return 'delivery';
    if (table === '' && type === '') return 'delivery';
    return 'table';
  }

  private async fetchActivityIndex(
    req: Request,
    menuId: number,
  ): Promise<Map<number, JsonRecord>> {
    const byStaffCallId = new Map<number, JsonRecord>();

    for (const channel of ['table', 'delivery'] as const) {
      const activity = await this.ensHttp.proxy({
        method: 'GET',
        path: `menus/${menuId}/activity-logs`,
        req,
        query: { channel, page: 1, limit: 100 },
      });

      if (activity.status === 403 || activity.status === 401) {
        this.logger.debug(
          `Activity logs unavailable for menuId=${menuId} (staff role may be waiter)`,
        );
        return byStaffCallId;
      }

      if (activity.status < 200 || activity.status >= 300 || !activity.data) {
        continue;
      }

      const body = activity.data as JsonRecord;
      const rows = (body.entries ?? body.calls) as unknown;
      if (!Array.isArray(rows)) continue;

      for (const raw of rows) {
        if (!raw || typeof raw !== 'object') continue;
        const row = raw as JsonRecord;
        const staffCallId = Number(row.orderId);
        if (!Number.isFinite(staffCallId) || staffCallId <= 0) continue;
        if (!byStaffCallId.has(staffCallId)) {
          byStaffCallId.set(staffCallId, row);
        }
      }
    }

    return byStaffCallId;
  }

  private extractStaffCalls(root: JsonRecord): JsonRecord[] {
    if (Array.isArray(root.calls)) {
      return root.calls.filter(
        (c): c is JsonRecord => c != null && typeof c === 'object',
      );
    }
    if (Array.isArray(root.entries)) {
      return root.entries.filter(
        (c): c is JsonRecord => c != null && typeof c === 'object',
      );
    }
    if (root.id != null && root.menuId != null) {
      return [root];
    }
    return [];
  }

  private resolveMenuId(calls: JsonRecord[]): number | null {
    for (const call of calls) {
      const menuId = Number(call.menuId);
      if (Number.isFinite(menuId) && menuId > 0) return menuId;
    }
    return null;
  }

  private hasText(value: unknown): boolean {
    return value != null && String(value).trim().length > 0;
  }

  private firstText(...candidates: unknown[]): string | null {
    for (const c of candidates) {
      if (this.hasText(c)) return String(c).trim();
    }
    return null;
  }
}
