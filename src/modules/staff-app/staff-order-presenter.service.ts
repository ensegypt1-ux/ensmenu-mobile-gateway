import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { EnsHttpService } from '../../infrastructure/ens-backend/ens-http.service';
import {
  activityLogIdFromRow,
  applyDeliveryFields,
  extractDeliveryCustomerFields,
  firstText,
  hasText,
  needsDeliveryDetailEnrichment,
  resolveOrderType,
  type StaffOrderEnrichmentSource,
} from './staff-order-delivery-enrichment.util';

type JsonRecord = Record<string, unknown>;

export type StaffOrderPresentResult = {
  data: JsonRecord;
  enrichment: StaffOrderEnrichmentSource;
};

/**
 * BFF presenter: staff-auth table-calls + activity-logs → web `CallEntry` shape.
 * Join: activityLog.orderId === staffTableCall.id
 *
 * Delivery customer fields (phone, zone, address, notes) live in MenuOrders.orderJson
 * and are exposed via GET /api/menus/:menuId/activity-logs(+/:id). Staff-auth table-calls
 * does not return them. This presenter merges activity-log data without changing Express.
 *
 * Access note (production backend): activity logs are readable for owner JWT and staff
 * with cashier/casher role. Waiter staff receive 403/404 from activity logs — enrichment
 * falls back to staff-auth only and delivery customer fields stay empty.
 */
@Injectable()
export class StaffOrderPresenterService {
  private readonly logger = new Logger(StaffOrderPresenterService.name);

  private static readonly ACTIVITY_PAGE_LIMIT = 100;
  private static readonly MAX_ACTIVITY_PAGES = 5;
  private static readonly DETAIL_ENRICH_CONCURRENCY = 6;

  constructor(private readonly ensHttp: EnsHttpService) {}

  async presentListPayload(
    req: Request,
    staffData: unknown,
  ): Promise<StaffOrderPresentResult> {
    if (!staffData || typeof staffData !== 'object') {
      return { data: staffData as JsonRecord, enrichment: 'staff-auth-only' };
    }

    const root = staffData as JsonRecord;
    const calls = this.extractStaffCalls(root);
    if (calls.length === 0) {
      return { data: { ...root, entries: [] }, enrichment: 'staff-auth-only' };
    }

    const menuId = this.resolveMenuId(calls);
    const targetIds = new Set(
      calls
        .map((c) => Number(c.id))
        .filter((id) => Number.isFinite(id) && id > 0),
    );

    const { byStaffCallId, activityLogAccess } =
      menuId != null
        ? await this.fetchActivityIndex(req, menuId, targetIds)
        : {
            byStaffCallId: new Map<number, JsonRecord>(),
            activityLogAccess: 'denied' as const,
          };

    let entries = calls.map((call) =>
      this.presentCall(call, byStaffCallId.get(Number(call.id))),
    );

    let enrichment: StaffOrderEnrichmentSource = 'staff-auth-only';
    if (activityLogAccess === 'granted') {
      enrichment = 'activity-log';
      const phonesBefore = entries.map(
        (e) => extractDeliveryCustomerFields(e).customerPhone,
      );
      entries = await this.enrichEntriesWithActivityDetails(
        req,
        menuId!,
        calls,
        entries,
        byStaffCallId,
      );
      const phonesAfter = entries.map(
        (e) => extractDeliveryCustomerFields(e).customerPhone,
      );
      if (
        phonesAfter.some(
          (phone, i) => !hasText(phonesBefore[i]) && hasText(phone),
        )
      ) {
        enrichment = 'activity-log-detail';
      }
    }

    return { data: { ...root, entries, calls }, enrichment };
  }

  async presentOnePayload(
    req: Request,
    staffData: unknown,
  ): Promise<StaffOrderPresentResult> {
    if (!staffData || typeof staffData !== 'object') {
      const entry = this.staffCallToEntry(staffData as JsonRecord);
      return { data: { entry }, enrichment: 'staff-auth-only' };
    }

    const staffCall = staffData as JsonRecord;
    const menuId = Number(staffCall.menuId);
    const staffCallId = Number(staffCall.id);

    if (!Number.isFinite(menuId) || menuId <= 0 || !Number.isFinite(staffCallId)) {
      const entry = this.staffCallToEntry(staffCall);
      return { data: { entry }, enrichment: 'staff-auth-only' };
    }

    const { byStaffCallId, activityLogAccess } = await this.fetchActivityIndex(
      req,
      menuId,
      new Set([staffCallId]),
    );

    let listEntry = this.presentCall(
      staffCall,
      byStaffCallId.get(staffCallId),
    );

    let enrichment: StaffOrderEnrichmentSource = 'staff-auth-only';
    if (activityLogAccess === 'granted') {
      enrichment = 'activity-log';
      const phoneBefore = extractDeliveryCustomerFields(listEntry).customerPhone;
      listEntry = await this.enrichSingleEntryWithActivityDetail(
        req,
        menuId,
        staffCall,
        listEntry,
        byStaffCallId.get(staffCallId),
      );
      const phoneAfter = extractDeliveryCustomerFields(listEntry).customerPhone;
      if (!hasText(phoneBefore) && hasText(phoneAfter)) {
        enrichment = 'activity-log-detail';
      }
    }

    return {
      data: { entry: listEntry, ...staffCall, entries: [listEntry] },
      enrichment,
    };
  }

  private async enrichEntriesWithActivityDetails(
    req: Request,
    menuId: number,
    calls: JsonRecord[],
    entries: JsonRecord[],
    index: Map<number, JsonRecord>,
  ): Promise<JsonRecord[]> {
    const out = [...entries];
    const tasks: Array<{ idx: number; call: JsonRecord; entry: JsonRecord }> =
      [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const call = calls[i];
      if (!entry || !call) continue;
      if (!needsDeliveryDetailEnrichment(entry)) continue;
      if (!activityLogIdFromRow(index.get(Number(call.id)))) continue;
      tasks.push({ idx: i, call, entry });
    }

    if (tasks.length === 0) return out;

    const queue = [...tasks];
    const workers = Array.from(
      { length: Math.min(StaffOrderPresenterService.DETAIL_ENRICH_CONCURRENCY, queue.length) },
      async () => {
        while (queue.length) {
          const task = queue.shift();
          if (!task) break;
          out[task.idx] = await this.enrichSingleEntryWithActivityDetail(
            req,
            menuId,
            task.call,
            task.entry,
            index.get(Number(task.call.id)),
          );
        }
      },
    );

    await Promise.all(workers);
    return out;
  }

  private async enrichSingleEntryWithActivityDetail(
    req: Request,
    menuId: number,
    staffCall: JsonRecord,
    entry: JsonRecord,
    listRow: JsonRecord | undefined,
  ): Promise<JsonRecord> {
    let merged = applyDeliveryFields(entry, listRow, staffCall);

    const activityLogId = activityLogIdFromRow(listRow);
    if (activityLogId == null) {
      return merged;
    }

    if (!needsDeliveryDetailEnrichment(merged)) {
      return merged;
    }

    const detail = await this.ensHttp.proxy({
      method: 'GET',
      path: `menus/${menuId}/activity-logs/${activityLogId}`,
      req,
    });

    if (detail.status < 200 || detail.status >= 300 || !detail.data) {
      return merged;
    }

    const body = detail.data as JsonRecord;
    const rawEntry = (body.entry ?? body) as JsonRecord;
    return this.presentDetail(rawEntry, staffCall, merged);
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

    const delivery = extractDeliveryCustomerFields(
      order,
      detail,
      listEntry,
      staffCall,
    );

    const merged: JsonRecord = applyDeliveryFields(
      {
        ...listEntry,
        ...detail,
        orderId: String(staffCall.id ?? listEntry.orderId),
        type: delivery.type ?? listEntry.type ?? resolveOrderType(staffCall),
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
      },
      order,
      detail,
      listEntry,
      staffCall,
    );

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

    const merged: JsonRecord = applyDeliveryFields(
      {
        ...activity,
        orderId: String(staffCall.id ?? activity.orderId ?? ''),
        menuId: staffCall.menuId ?? activity.menuId,
        items:
          Array.isArray(staffCall.items) && staffCall.items.length
            ? staffCall.items
            : activity.items,
        totalPrice: staffCall.orderTotal ?? activity.totalPrice,
        type:
          firstText(activity.type, nestedOrder(activity)?.type) ??
          resolveOrderType(staffCall),
      },
      activity,
      nestedOrder(activity),
      staffCall,
    );

    if (!hasText(merged.tableNumber) && staffCall.tableNumber != null) {
      merged.tableNumber = staffCall.tableNumber;
    }

    return merged;
  }

  private staffCallToEntry(call: JsonRecord): JsonRecord {
    const id = String(call.id ?? '');
    const at = String(call.at ?? call.requestedAt ?? call.createdAt ?? '');
    const status = String(call.status ?? 'pending')
      .trim()
      .toLowerCase();
    const items = Array.isArray(call.items) ? call.items : [];
    const type = resolveOrderType(call);
    const delivery = extractDeliveryCustomerFields(call);

    return applyDeliveryFields(
      {
        id,
        orderId: id,
        menuId: call.menuId ?? null,
        lastAction:
          status === 'pending'
            ? 'TABLE_CALL_CREATED'
            : `TABLE_CALL_${status.toUpperCase()}`,
        actionDetails: [{ status, time: at, waiterName: '' }],
        customerName: call.customerName ?? null,
        tableNumber: call.tableNumber ?? null,
        type,
        items,
        totalPrice: call.orderTotal ?? 0,
      },
      call,
      delivery,
    );
  }

  private async fetchActivityIndex(
    req: Request,
    menuId: number,
    targetStaffCallIds?: Set<number>,
  ): Promise<{
    byStaffCallId: Map<number, JsonRecord>;
    activityLogAccess: 'granted' | 'denied';
  }> {
    const byStaffCallId = new Map<number, JsonRecord>();
    let accessDenied = false;
    let anySuccess = false;

    const queryVariants: Array<Record<string, unknown>> = [
      {},
      { channel: 'delivery' },
      { channel: 'table' },
    ];

    const allTargetsFound = (): boolean => {
      if (!targetStaffCallIds || targetStaffCallIds.size === 0) return false;
      for (const id of targetStaffCallIds) {
        if (!byStaffCallId.has(id)) return false;
      }
      return true;
    };

    for (const variant of queryVariants) {
      if (accessDenied) break;
      if (allTargetsFound()) break;

      for (let page = 1; page <= StaffOrderPresenterService.MAX_ACTIVITY_PAGES; page++) {
        const activity = await this.ensHttp.proxy({
          method: 'GET',
          path: `menus/${menuId}/activity-logs`,
          req,
          query: {
            ...variant,
            page,
            limit: StaffOrderPresenterService.ACTIVITY_PAGE_LIMIT,
          },
        });

        if (
          activity.status === 403 ||
          activity.status === 401 ||
          activity.status === 404
        ) {
          accessDenied = true;
          this.logger.debug(
            `Activity logs denied for menuId=${menuId} (status=${activity.status}). ` +
              'Delivery customer fields require cashier/casher staff or owner access on Express.',
          );
          break;
        }

        if (activity.status < 200 || activity.status >= 300 || !activity.data) {
          break;
        }

        anySuccess = true;
        const body = activity.data as JsonRecord;
        const rows = (body.entries ?? body.calls) as unknown;
        if (!Array.isArray(rows) || rows.length === 0) {
          break;
        }

        for (const raw of rows) {
          if (!raw || typeof raw !== 'object') continue;
          const row = raw as JsonRecord;
          const staffCallId = Number(row.orderId);
          if (!Number.isFinite(staffCallId) || staffCallId <= 0) continue;
          if (!byStaffCallId.has(staffCallId)) {
            byStaffCallId.set(staffCallId, row);
          }
        }

        const totalPages = Number(body.totalPages ?? 1);
        if (!Number.isFinite(totalPages) || page >= totalPages) {
          break;
        }
        if (allTargetsFound()) break;
      }
    }

    return {
      byStaffCallId,
      activityLogAccess: anySuccess ? 'granted' : 'denied',
    };
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
}

function nestedOrder(record: JsonRecord | undefined): JsonRecord | null {
  if (!record) return null;
  const order = record.order;
  return order != null && typeof order === 'object' ? (order as JsonRecord) : null;
}
