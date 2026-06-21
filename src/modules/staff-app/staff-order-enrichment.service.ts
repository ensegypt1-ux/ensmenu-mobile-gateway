import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { EnsHttpService } from '../../infrastructure/ens-backend/ens-http.service';

type JsonRecord = Record<string, unknown>;

export type StaffOrderEnrichmentOutcome =
  | 'skipped'
  | 'success'
  | 'partial'
  | 'forbidden'
  | 'failed';

export type StaffOrderEnrichmentResult = {
  data: unknown;
  outcome: StaffOrderEnrichmentOutcome;
  menuId?: number;
  needsEnrichment?: number;
  enriched?: number;
  activityStatus?: number;
};

/**
 * BFF enrichment: staff-auth table-calls + existing activity-logs (web dashboard feed).
 * Join key: activityLogEntry.orderId === staffTableCall.id
 *
 * Uses production APIs only — no backend code or permission changes.
 * Cashier/casher staff can read activity-logs; waiters receive 403 and orders pass through unchanged.
 */
@Injectable()
export class StaffOrderEnrichmentService {
  private readonly logger = new Logger(StaffOrderEnrichmentService.name);

  constructor(private readonly ensHttp: EnsHttpService) {}

  async enrichOrderPayload(
    req: Request,
    data: unknown,
  ): Promise<StaffOrderEnrichmentResult> {
    if (!data || typeof data !== 'object') {
      return { data, outcome: 'skipped' };
    }

    const root = data as JsonRecord;
    const calls = this.extractCalls(root);
    if (calls.length === 0) {
      return { data, outcome: 'skipped' };
    }

    const menuId = this.resolveMenuId(calls);
    if (menuId == null) {
      return { data, outcome: 'skipped' };
    }

    const needsEnrichment = calls.filter((call) =>
      this.callNeedsEnrichment(call),
    );
    if (needsEnrichment.length === 0) {
      return {
        data,
        outcome: 'skipped',
        menuId,
        needsEnrichment: 0,
        enriched: 0,
      };
    }

    const activity = await this.ensHttp.proxy({
      method: 'GET',
      path: `menus/${menuId}/activity-logs`,
      req,
      query: { channel: 'delivery', page: 1, limit: 100 },
    });

    const activityStatus = activity.status;

    if (activityStatus === 403 || activityStatus === 401) {
      this.logger.warn(
        `Staff order enrichment forbidden: menuId=${menuId} activityStatus=${activityStatus} ` +
          `(likely waiter staff — returning staff-auth data unchanged)`,
      );
      return {
        data,
        outcome: 'forbidden',
        menuId,
        needsEnrichment: needsEnrichment.length,
        enriched: 0,
        activityStatus,
      };
    }

    if (activityStatus < 200 || activityStatus >= 300 || !activity.data) {
      this.logger.warn(
        `Staff order enrichment failed: menuId=${menuId} activityStatus=${activityStatus} ` +
          `(returning staff-auth data unchanged)`,
      );
      return {
        data,
        outcome: 'failed',
        menuId,
        needsEnrichment: needsEnrichment.length,
        enriched: 0,
        activityStatus,
      };
    }

    const body = activity.data as JsonRecord;
    const entries = (body.entries ?? body.calls) as unknown;
    if (!Array.isArray(entries) || entries.length === 0) {
      this.logger.warn(
        `Staff order enrichment failed: menuId=${menuId} activityStatus=${activityStatus} ` +
          `(empty activity log — returning staff-auth data unchanged)`,
      );
      return {
        data,
        outcome: 'failed',
        menuId,
        needsEnrichment: needsEnrichment.length,
        enriched: 0,
        activityStatus,
      };
    }

    const byStaffCallId = this.indexActivityEntries(entries);
    let enriched = 0;

    for (const call of needsEnrichment) {
      const staffCallId = Number(call.id);
      const entry = byStaffCallId.get(staffCallId);
      if (!entry) continue;
      if (this.mergeCallFromActivity(call, entry)) {
        enriched += 1;
      }
    }

    const outcome: StaffOrderEnrichmentOutcome =
      enriched === 0
        ? 'failed'
        : enriched < needsEnrichment.length
          ? 'partial'
          : 'success';

    if (outcome === 'success') {
      this.logger.log(
        `Staff order enrichment success: menuId=${menuId} enriched=${enriched}/${needsEnrichment.length}`,
      );
    } else if (outcome === 'partial') {
      this.logger.warn(
        `Staff order enrichment partial: menuId=${menuId} enriched=${enriched}/${needsEnrichment.length} ` +
          `(some delivery orders had no matching activity log row)`,
      );
    } else {
      this.logger.warn(
        `Staff order enrichment failed: menuId=${menuId} matched=0/${needsEnrichment.length} ` +
          `(activity logs returned but no orderId matches)`,
      );
    }

    return {
      data: root,
      outcome,
      menuId,
      needsEnrichment: needsEnrichment.length,
      enriched,
      activityStatus,
    };
  }

  private extractCalls(root: JsonRecord): JsonRecord[] {
    if (Array.isArray(root.calls)) {
      return root.calls.filter(
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

  private indexActivityEntries(entries: unknown[]): Map<number, JsonRecord> {
    const byStaffCallId = new Map<number, JsonRecord>();
    for (const raw of entries) {
      if (!raw || typeof raw !== 'object') continue;
      const entry = raw as JsonRecord;
      const staffCallId = Number(entry.orderId);
      if (!Number.isFinite(staffCallId) || staffCallId <= 0) continue;
      byStaffCallId.set(staffCallId, entry);
    }
    return byStaffCallId;
  }

  private callNeedsEnrichment(call: JsonRecord): boolean {
    if (!this.isDeliveryCall(call)) return false;

    return (
      !this.hasText(call.customerPhone) ||
      !this.hasText(call.customerAddress) ||
      !this.hasText(call.orderNotes) ||
      (!this.hasText(call.governorateNameAr) &&
        !this.hasText(call.governorateNameEn)) ||
      call.deliveryFee == null
    );
  }

  private isDeliveryCall(call: JsonRecord): boolean {
    const type = String(call.type ?? '')
      .trim()
      .toLowerCase();
    if (type === 'delivery') return true;
    if (type === 'table') return false;
    const table = String(call.tableNumber ?? '')
      .trim()
      .toLowerCase();
    if (table === 'delivery') return true;
    // Legacy staff rows: empty tableNumber with no type (Staff app treats as online/delivery).
    if (table === '' && type === '') return true;
    return false;
  }

  /** Returns true if at least one field was filled. */
  private mergeCallFromActivity(call: JsonRecord, entry: JsonRecord): boolean {
    const nested =
      entry.order && typeof entry.order === 'object'
        ? (entry.order as JsonRecord)
        : null;

    let changed = false;
    changed =
      this.fillIfEmpty(
        call,
        'customerName',
        entry.customerName,
        nested?.customerName,
      ) || changed;
    changed =
      this.fillIfEmpty(
        call,
        'customerPhone',
        entry.customerPhone,
        nested?.customerPhone,
      ) || changed;
    changed =
      this.fillIfEmpty(
        call,
        'customerAddress',
        entry.customerAddress,
        nested?.customerAddress,
      ) || changed;
    changed =
      this.fillIfEmpty(
        call,
        'orderNotes',
        entry.orderNotes,
        nested?.orderNotes,
      ) || changed;
    changed =
      this.fillIfEmpty(
        call,
        'governorateNameAr',
        entry.governorateNameAr,
        nested?.governorateNameAr,
      ) || changed;
    changed =
      this.fillIfEmpty(
        call,
        'governorateNameEn',
        entry.governorateNameEn,
        nested?.governorateNameEn,
      ) || changed;

    if (call.governorateId == null && entry.governorateId != null) {
      call.governorateId = entry.governorateId;
      changed = true;
    } else if (call.governorateId == null && nested?.governorateId != null) {
      call.governorateId = nested.governorateId;
      changed = true;
    }

    if (call.deliveryFee == null && entry.deliveryFee != null) {
      call.deliveryFee = entry.deliveryFee;
      changed = true;
    } else if (call.deliveryFee == null && nested?.deliveryFee != null) {
      call.deliveryFee = nested.deliveryFee;
      changed = true;
    }

    return changed;
  }

  private fillIfEmpty(
    call: JsonRecord,
    key: string,
    ...candidates: unknown[]
  ): boolean {
    if (this.hasText(call[key])) return false;
    for (const candidate of candidates) {
      if (this.hasText(candidate)) {
        call[key] = String(candidate).trim();
        return true;
      }
    }
    return false;
  }

  private hasText(value: unknown): boolean {
    return value != null && String(value).trim().length > 0;
  }
}
