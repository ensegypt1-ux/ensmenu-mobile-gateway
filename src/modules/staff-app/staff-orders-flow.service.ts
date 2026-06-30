import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { verifyAccessTokenLocally } from '../../common/utils/jwt-payload.util';
import { EnsHttpService } from '../../infrastructure/ens-backend/ens-http.service';
import {
  StaffOrderPresenterService,
  StaffOrderPresentResult,
} from './staff-order-presenter.service';
import {
  canStaffAccessDelivery,
  normalizeStaffJobRole,
  resolveStaffJobRoleFromRequest,
  type StaffJobRole,
} from './staff-job-role.util';
import {
  activityLogIdFromRow,
  resolveOrderType,
} from './staff-order-delivery-enrichment.util';
import {
  buildSubmissionView,
  cashierCanActOnPending,
  enrichRowWithSubmission,
  matchesStaffQueueFilter,
  parseStaffQueueFilter,
  requiresWaiterSubmission,
  resolveLifecycleStatus,
  visibleToCashierActive,
  type StaffQueueFilter,
} from './staff-order-gate.util';
import {
  StaffOrderSubmissionService,
  type StaffOrderSubmissionRecord,
} from './staff-order-submission.service';

type JsonRecord = Record<string, unknown>;

const ACTIVITY_QUERY_KEYS = [
  'page',
  'limit',
  'channel',
  'q',
  'dateFrom',
  'dateTo',
  'status',
] as const;

const EMPTY_LIST_PAYLOAD: JsonRecord = {
  entries: [],
  calls: [],
  total: 0,
  page: 1,
  limit: 100,
  totalPages: 1,
};

@Injectable()
export class StaffOrdersFlowService {
  private readonly logger = new Logger(StaffOrdersFlowService.name);

  constructor(
    private readonly ensHttp: EnsHttpService,
    private readonly presenter: StaffOrderPresenterService,
    private readonly configService: ConfigService,
    private readonly submissions: StaffOrderSubmissionService,
  ) {}

  /** JWT `staffJobRole` first; falls back to `staff-auth/me` when absent. */
  async resolveRole(req: Request): Promise<StaffJobRole> {
    const fromJwt = resolveStaffJobRoleFromRequest(req, this.configService);
    const user = verifyAccessTokenLocally(req, this.configService);

    if (fromJwt === 'cashier') return 'cashier';
    if (fromJwt === 'waiter' && user?.staffJobRole) return 'waiter';

    const fromMe = await this.resolveRoleFromStaffMe(req);
    if (fromMe !== 'unknown') return fromMe;

    return fromJwt === 'unknown' ? (user ? 'waiter' : 'unknown') : fromJwt;
  }

  usesActivityLogs(role: StaffJobRole, menuId: number): boolean {
    return canStaffAccessDelivery(role) && Number.isFinite(menuId) && menuId > 0;
  }

  /** Block waiter from cashier-only mutations (accept, cancel, put, status). */
  async denyWaiterCashierMutation(req: Request) {
    const role = await this.resolveRole(req);
    if (canStaffAccessDelivery(role)) return null;
    return {
      status: 403,
      data: {
        error: 'Order actions require cashier staff role',
        errorAr: 'إجراءات الطلبات تتطلب دور الكاشير',
        code: 'STAFF_ACTION_DENIED',
      },
    };
  }

  /** Waiter may edit items only before sending to cashier. */
  async denyWaiterItemEdit(
    req: Request,
    staffCallId: number,
    menuId: number,
  ) {
    const role = await this.resolveRole(req);
    if (canStaffAccessDelivery(role)) return null;

    const snap = await this.fetchStaffCallSnapshot(req, staffCallId);
    if (!snap) {
      return {
        status: 404,
        data: {
          error: 'Order not found',
          errorAr: 'الطلب غير موجود',
          code: 'ORDER_NOT_FOUND',
        },
      };
    }

    const presented = await this.presenter.presentOnePayload(req, snap);
    const entry = (presented.data.entry ?? presented.data) as JsonRecord;
    const status = resolveLifecycleStatus(entry);

    if (status !== 'pending') {
      return {
        status: 409,
        data: {
          error: 'Order is no longer editable by waiter',
          errorAr: 'لا يمكن للنادل تعديل الطلب بعد الإرسال',
          code: 'WAITER_EDIT_DENIED',
        },
      };
    }

    if (
      requiresWaiterSubmission(entry) &&
      this.submissions.isSubmitted(menuId, staffCallId)
    ) {
      return {
        status: 409,
        data: {
          error: 'Order already submitted to cashier',
          errorAr: 'تم إرسال الطلب للكاشير',
          code: 'ALREADY_SUBMITTED',
        },
      };
    }

    return null;
  }

  private async fetchStaffCallSnapshot(
    req: Request,
    staffCallId: number,
  ): Promise<JsonRecord | null> {
    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: `staff-auth/table-calls/${staffCallId}`,
      req,
    });
    if (result.status < 200 || result.status >= 300 || !result.data) {
      return null;
    }
    return result.data as JsonRecord;
  }

  private submissionForRow(
    menuId: number,
    row: JsonRecord,
  ): StaffOrderSubmissionRecord | null {
    const staffCallId = Number(row.orderId ?? row.id);
    if (!Number.isFinite(staffCallId) || staffCallId <= 0) return null;
    return this.submissions.get(menuId, staffCallId);
  }

  private enrichEntriesWithGate(
    menuId: number,
    rows: JsonRecord[],
  ): JsonRecord[] {
    if (!Number.isFinite(menuId) || menuId <= 0) return rows;
    return rows.map((row) => {
      const submission = this.submissionForRow(menuId, row);
      return enrichRowWithSubmission(
        row,
        submission
          ? {
              submittedAt: submission.submittedAt,
              submittedByStaffId: submission.submittedByStaffId,
              submittedByStaffName: submission.submittedByStaffName,
            }
          : null,
      );
    });
  }

  private filterPresentedRows(
    role: StaffJobRole,
    rows: JsonRecord[],
    query: Record<string, unknown>,
    upstreamPath: string,
  ): JsonRecord[] {
    const staffQueue = parseStaffQueueFilter(query.staffQueue);

    if (staffQueue) {
      return rows.filter((row) => matchesStaffQueueFilter(row, staffQueue));
    }

    if (role === 'waiter') {
      return rows.filter((row) => {
        const phase = String(row.mobileQueuePhase ?? '');
        return phase !== 'cashier_pending' || resolveOrderType(row) === 'delivery';
      });
    }

    if (role === 'cashier' && upstreamPath.includes('table-calls/history')) {
      return rows;
    }

    if (role === 'cashier') {
      return rows.filter((row) => visibleToCashierActive(row));
    }

    return rows;
  }

  private applyGateToPresented(
    req: Request,
    role: StaffJobRole,
    query: Record<string, unknown>,
    upstreamPath: string,
    presented: StaffOrderPresentResult,
    menuId: number,
  ): StaffOrderPresentResult {
    let entries = this.extractCalls(presented.data);
    if (entries.length === 0 && Array.isArray(presented.data.entries)) {
      entries = presented.data.entries as JsonRecord[];
    }

    const resolvedMenuId =
      Number.isFinite(menuId) && menuId > 0
        ? menuId
        : this.parseMenuId(query);

    const enriched = this.enrichEntriesWithGate(resolvedMenuId, entries);
    const filtered = this.filterPresentedRows(
      role,
      enriched,
      query,
      upstreamPath,
    );

    const entry = presented.data.entry;
    let enrichedEntry = entry;
    if (entry && typeof entry === 'object') {
      const submission = this.submissionForRow(
        resolvedMenuId,
        entry as JsonRecord,
      );
      enrichedEntry = enrichRowWithSubmission(
        entry as JsonRecord,
        submission
          ? {
              submittedAt: submission.submittedAt,
              submittedByStaffId: submission.submittedByStaffId,
              submittedByStaffName: submission.submittedByStaffName,
            }
          : null,
      );
    }

    return {
      ...presented,
      data: {
        ...presented.data,
        entries: filtered,
        calls: filtered,
        total: filtered.length,
        ...(enrichedEntry ? { entry: enrichedEntry } : {}),
      },
      staffJobRole: role,
    };
  }

  parseMenuId(query: Record<string, unknown>, body?: unknown): number {
    const fromQuery = Number(query.menuId);
    if (Number.isFinite(fromQuery) && fromQuery > 0) return fromQuery;
    if (body && typeof body === 'object') {
      const fromBody = Number((body as JsonRecord).menuId);
      if (Number.isFinite(fromBody) && fromBody > 0) return fromBody;
    }
    return NaN;
  }

  private pickActivityQuery(
    query: Record<string, unknown>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of ACTIVITY_QUERY_KEYS) {
      const value = query[key];
      if (value != null && value !== '') out[key] = value;
    }
    return out;
  }

  private pickStaffAuthQuery(
    query: Record<string, unknown>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (query.limit != null && query.limit !== '') out.limit = query.limit;
    if (query.page != null && query.page !== '') out.page = query.page;
    return out;
  }

  private staffIdFromRequest(req: Request): number | string {
    const user = verifyAccessTokenLocally(req, this.configService);
    return user?.userId ?? 'jwt-unverified';
  }

  private countListRows(data: unknown): number {
    if (!data || typeof data !== 'object') return 0;
    const root = data as JsonRecord;
    const entries = root.entries;
    if (Array.isArray(entries)) return entries.length;
    const calls = root.calls;
    if (Array.isArray(calls)) return calls.length;
    return 0;
  }

  private extractCalls(data: unknown): JsonRecord[] {
    if (!data || typeof data !== 'object') return [];
    const root = data as JsonRecord;
    const raw = root.calls ?? root.entries;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (row): row is JsonRecord => row != null && typeof row === 'object',
    );
  }

  private filterEntriesByChannel(
    rows: JsonRecord[],
    channel: string,
  ): JsonRecord[] {
    if (channel !== 'table' && channel !== 'delivery') return rows;
    return rows.filter((row) => {
      const isDelivery = resolveOrderType(row) === 'delivery';
      return channel === 'delivery' ? isDelivery : !isDelivery;
    });
  }

  private logListOrdersDebug(context: {
    req: Request;
    role: StaffJobRole;
    menuId: number;
    channel: string;
    upstreamPath: string;
    upstreamUrl: string;
    upstreamStatus: number;
    upstreamCount: number;
    filteredCount?: number;
    finalCount: number;
    enrichment: string;
    usedFallback: boolean;
  }): void {
    this.logger.warn(
      `[staff-orders-debug] staffId=${this.staffIdFromRequest(context.req)} ` +
        `role=${context.role} menuId=${Number.isFinite(context.menuId) ? context.menuId : 'n/a'} ` +
        `channel=${context.channel || 'all'} ` +
        `upstream=${context.upstreamPath} status=${context.upstreamStatus} ` +
        `upstreamCount=${context.upstreamCount} ` +
        `filteredCount=${context.filteredCount ?? context.finalCount} ` +
        `finalCount=${context.finalCount} enrichment=${context.enrichment} ` +
        `fallback=${context.usedFallback} url=${context.upstreamUrl}`,
    );
  }

  private async resolveRoleFromStaffMe(req: Request): Promise<StaffJobRole> {
    const me = await this.ensHttp.proxy({
      method: 'GET',
      path: 'staff-auth/me',
      req,
    });

    if (me.status < 200 || me.status >= 300 || !me.data || typeof me.data !== 'object') {
      return 'unknown';
    }

    const staff = (me.data as JsonRecord).staff;
    if (!staff || typeof staff !== 'object') return 'unknown';

    const fromMe = normalizeStaffJobRole((staff as JsonRecord).role);
    return fromMe === 'unknown' ? 'unknown' : fromMe;
  }

  /**
   * Active lists merge pending + history so confirmed/prepared orders appear
   * when activity logs are empty and we fall back to staff-auth.
   */
  private async proxyStaffAuthList(
    req: Request,
    query: Record<string, unknown>,
    upstreamPath: 'staff-auth/table-calls' | 'staff-auth/table-calls/history',
  ) {
    const staffQuery = this.pickStaffAuthQuery(query);

    if (upstreamPath !== 'staff-auth/table-calls') {
      return this.ensHttp.proxy({
        method: 'GET',
        path: upstreamPath,
        req,
        query: staffQuery,
      });
    }

    const limit = Number(staffQuery.limit ?? 100);
    const [pending, history] = await Promise.all([
      this.ensHttp.proxy({
        method: 'GET',
        path: 'staff-auth/table-calls',
        req,
        query: staffQuery,
      }),
      this.ensHttp.proxy({
        method: 'GET',
        path: 'staff-auth/table-calls/history',
        req,
        query: { page: 1, limit: Number.isFinite(limit) ? limit : 100 },
      }),
    ]);

    if (pending.status >= 200 && pending.status < 300) {
      const byId = new Map<number, JsonRecord>();

      if (history.status >= 200 && history.status < 300) {
        for (const call of this.extractCalls(history.data)) {
          const id = Number(call.id);
          if (Number.isFinite(id) && id > 0) byId.set(id, call);
        }
      }

      for (const call of this.extractCalls(pending.data)) {
        const id = Number(call.id);
        if (Number.isFinite(id) && id > 0) byId.set(id, call);
      }

      return {
        status: 200,
        data: { calls: Array.from(byId.values()) },
      };
    }

    if (history.status >= 200 && history.status < 300) {
      return history;
    }

    return pending;
  }

  private async presentStaffAuthList(
    req: Request,
    query: Record<string, unknown>,
    upstreamPath: 'staff-auth/table-calls' | 'staff-auth/table-calls/history',
    role: StaffJobRole,
  ): Promise<StaffOrderPresentResult> {
    const channel = String(query.channel ?? '').trim().toLowerCase();
    const result = await this.proxyStaffAuthList(req, query, upstreamPath);

    if (result.status < 200 || result.status >= 300) {
      return {
        data: { ...EMPTY_LIST_PAYLOAD },
        enrichment: 'staff-auth-only',
        staffJobRole: role,
        httpStatus: 200,
      };
    }

    const presented = await this.presenter.presentListPayload(req, result.data);
    let entries = this.extractCalls(presented.data);
    if (entries.length === 0 && Array.isArray(presented.data.entries)) {
      entries = presented.data.entries as JsonRecord[];
    }

    const filtered = this.filterEntriesByChannel(entries, channel);

    const base: StaffOrderPresentResult = {
      data: {
        ...presented.data,
        entries: filtered,
        calls: filtered,
        total: filtered.length,
      },
      enrichment: presented.enrichment,
      staffJobRole: role,
      httpStatus: 200,
    };

    return this.applyGateToPresented(
      req,
      role,
      query,
      upstreamPath,
      base,
      this.parseMenuId(query),
    );
  }

  /** Cashier: activity-logs with staff-auth fallback. Waiter: staff-auth table-calls. */
  async listOrders(
    req: Request,
    query: Record<string, unknown>,
    upstreamPath: 'staff-auth/table-calls' | 'staff-auth/table-calls/history',
  ): Promise<StaffOrderPresentResult> {
    const role = await this.resolveRole(req);
    const menuId = this.parseMenuId(query);
    const channel = String(query.channel ?? '').trim().toLowerCase();

    if (this.usesActivityLogs(role, menuId)) {
      const activityPath = `menus/${menuId}/activity-logs`;
      const activityQuery = this.pickActivityQuery(query);
      const upstreamUrl = this.ensHttp.buildUrl(activityPath, activityQuery);

      const result = await this.ensHttp.proxy({
        method: 'GET',
        path: activityPath,
        req,
        query: activityQuery,
      });

      const upstreamCount = this.countListRows(result.data);
      const activityOk =
        result.status >= 200 && result.status < 300 && result.data != null;

      if (activityOk && upstreamCount > 0) {
        this.logListOrdersDebug({
          req,
          role,
          menuId,
          channel,
          upstreamPath: activityPath,
          upstreamUrl,
          upstreamStatus: result.status,
          upstreamCount,
          finalCount: upstreamCount,
          enrichment: 'activity-log',
          usedFallback: false,
        });

        return this.applyGateToPresented(
          req,
          role,
          query,
          upstreamPath,
          {
            data: result.data as JsonRecord,
            enrichment: 'activity-log',
            staffJobRole: role,
            httpStatus: 200,
          },
          menuId,
        );
      }

      const fallback = await this.presentStaffAuthList(
        req,
        query,
        upstreamPath,
        role,
      );
      const finalCount = this.countListRows(fallback.data);

      this.logListOrdersDebug({
        req,
        role,
        menuId,
        channel,
        upstreamPath: activityPath,
        upstreamUrl,
        upstreamStatus: result.status,
        upstreamCount,
        filteredCount: finalCount,
        finalCount,
        enrichment: fallback.enrichment,
        usedFallback: true,
      });

      return fallback;
    }

    const staffAuthPath = upstreamPath;
    const staffQuery = this.pickStaffAuthQuery(query);
    const upstreamUrl = this.ensHttp.buildUrl(staffAuthPath, staffQuery);
    const presented = await this.presentStaffAuthList(
      req,
      query,
      upstreamPath,
      role,
    );
    const finalCount = this.countListRows(presented.data);

    this.logListOrdersDebug({
      req,
      role,
      menuId,
      channel,
      upstreamPath: staffAuthPath,
      upstreamUrl,
      upstreamStatus: 200,
      upstreamCount: finalCount,
      finalCount,
      enrichment: presented.enrichment,
      usedFallback: false,
    });

    return presented;
  }

  /** Cashier detail: prefer full activity-log entry (web `?entry=` modal). */
  async getOrder(
    req: Request,
    staffCallId: number,
    menuIdFromQuery: number,
  ): Promise<StaffOrderPresentResult> {
    const role = await this.resolveRole(req);
    const menuId = menuIdFromQuery;

    if (this.usesActivityLogs(role, menuId)) {
      const staffResult = await this.ensHttp.proxy({
        method: 'GET',
        path: `staff-auth/table-calls/${staffCallId}`,
        req,
      });

      if (staffResult.status >= 200 && staffResult.status < 300 && staffResult.data) {
        const staffCall = staffResult.data as JsonRecord;
        const activityLogId = await this.resolveActivityLogId(
          req,
          menuId,
          staffCallId,
        );

        if (activityLogId != null) {
          const detail = await this.ensHttp.proxy({
            method: 'GET',
            path: `menus/${menuId}/activity-logs/${activityLogId}`,
            req,
          });

          if (detail.status >= 200 && detail.status < 300 && detail.data) {
            const body = detail.data as JsonRecord;
            const rawEntry = (body.entry ?? body) as JsonRecord;
            const listEntry = this.presenter.presentFromActivityDetail(
              staffCall,
              rawEntry,
            );
            return this.applyGateToPresented(
              req,
              role,
              { menuId },
              'staff-auth/table-calls',
              {
                data: { entry: listEntry, ...staffCall, entries: [listEntry] },
                enrichment: 'activity-log-detail',
                staffJobRole: role,
              },
              menuId,
            );
          }
        }
      }
    }

    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: `staff-auth/table-calls/${staffCallId}`,
      req,
    });

    if (result.status >= 200 && result.status < 300) {
      const presented = await this.presenter.presentOnePayload(req, result.data);
      return this.applyGateToPresented(
        req,
        role,
        { menuId: menuIdFromQuery },
        'staff-auth/table-calls',
        presented,
        menuIdFromQuery,
      );
    }

    return {
      data: (result.data ?? {}) as JsonRecord,
      enrichment: 'staff-auth-only',
      staffJobRole: role,
    };
  }

  async resolveActivityLogId(
    req: Request,
    menuId: number,
    staffCallId: number,
  ): Promise<number | null> {
    if (!Number.isFinite(menuId) || menuId <= 0 || !Number.isFinite(staffCallId)) {
      return null;
    }

    for (const channel of ['table', 'delivery', undefined] as const) {
      const query: Record<string, unknown> = { page: 1, limit: 100 };
      if (channel) query.channel = channel;

      const activity = await this.ensHttp.proxy({
        method: 'GET',
        path: `menus/${menuId}/activity-logs`,
        req,
        query,
      });

      if (activity.status < 200 || activity.status >= 300 || !activity.data) {
        continue;
      }

      const body = activity.data as JsonRecord;
      const rows = (body.entries ?? body.calls) as unknown;
      if (!Array.isArray(rows)) continue;

      for (const raw of rows) {
        if (!raw || typeof raw !== 'object') continue;
        const row = raw as JsonRecord;
        if (Number(row.orderId) !== staffCallId) continue;
        const fromUtil = activityLogIdFromRow(row);
        if (fromUtil != null) return fromUtil;
        const rowId = Number(row.id);
        if (Number.isFinite(rowId) && rowId > 0 && rowId !== staffCallId) {
          return rowId;
        }
      }
    }

    return null;
  }

  /** Waiter sends reviewed table order to cashier queue (gateway gate store). */
  async submitToCashier(
    req: Request,
    staffCallId: number,
    menuId: number,
  ) {
    const role = await this.resolveRole(req);
    if (role !== 'waiter') {
      return {
        status: 403,
        data: {
          error: 'Only waiters may submit orders to cashier',
          errorAr: 'فقط النادل يمكنه إرسال الطلب للكاشير',
          code: 'STAFF_ACTION_DENIED',
        },
      };
    }

    if (!Number.isFinite(menuId) || menuId <= 0) {
      return {
        status: 400,
        data: {
          error: 'menuId is required',
          errorAr: 'menuId مطلوب',
          code: 'MENU_ID_REQUIRED',
        },
      };
    }

    const snap = await this.fetchStaffCallSnapshot(req, staffCallId);
    if (!snap) {
      return {
        status: 404,
        data: {
          error: 'Order not found',
          errorAr: 'الطلب غير موجود',
          code: 'ORDER_NOT_FOUND',
        },
      };
    }

    const presentedSnap = await this.presenter.presentOnePayload(req, snap);
    const entry = (presentedSnap.data.entry ?? presentedSnap.data) as JsonRecord;
    const status = resolveLifecycleStatus(entry);

    if (status !== 'pending') {
      return {
        status: 409,
        data: {
          error: 'Only pending orders can be submitted to cashier',
          errorAr: 'يمكن إرسال الطلبات قيد الانتظار فقط',
          code: 'INVALID_ORDER_STATE',
        },
      };
    }

    if (!requiresWaiterSubmission(entry)) {
      return {
        status: 409,
        data: {
          error: 'This order does not require waiter submission',
          errorAr: 'هذا الطلب لا يتطلب مراجعة النادل',
          code: 'SUBMISSION_NOT_REQUIRED',
        },
      };
    }

    if (this.submissions.isSubmitted(menuId, staffCallId)) {
      return {
        status: 409,
        data: {
          error: 'Order already submitted to cashier',
          errorAr: 'تم إرسال الطلب للكاشير مسبقاً',
          code: 'ALREADY_SUBMITTED',
        },
      };
    }

    const user = verifyAccessTokenLocally(req, this.configService);
    const staffId = Number(user?.userId);
    if (!Number.isFinite(staffId) || staffId <= 0) {
      return {
        status: 403,
        data: {
          error: 'Staff identity required',
          errorAr: 'هوية الموظف مطلوبة',
          code: 'STAFF_ACTION_DENIED',
        },
      };
    }

    let staffName = '';
    const me = await this.ensHttp.proxy({
      method: 'GET',
      path: 'staff-auth/me',
      req,
    });
    if (me.status >= 200 && me.status < 300 && me.data && typeof me.data === 'object') {
      const staff = (me.data as JsonRecord).staff;
      if (staff && typeof staff === 'object') {
        staffName = String((staff as JsonRecord).name ?? '').trim();
      }
    }

    const submittedAt = new Date().toISOString();
    await this.submissions.recordSubmission({
      menuId,
      staffCallId,
      submittedAt,
      submittedByStaffId: staffId,
      submittedByStaffName: staffName || undefined,
    });

    const items = Array.isArray(snap.items) ? snap.items : [];
    if (items.length > 0) {
      await this.ensHttp.proxy({
        method: 'PATCH',
        path: `staff-auth/table-calls/${staffCallId}/items`,
        req,
        body: { items },
      });
    }

    const presented = await this.getOrder(req, staffCallId, menuId);
    return {
      status: 200,
      data: {
        ok: true,
        submittedToCashierAt: submittedAt,
        submittedByStaffId: staffId,
        submittedByStaffName: staffName || null,
        order: presented.data,
      },
    };
  }

  /** Mirrors web `POST /menus/:menuId/activity-logs/:entryId/actions`. */
  async postOrderAction(
    req: Request,
    staffCallId: number,
    action: string,
    menuId: number,
  ) {
    const role = await this.resolveRole(req);
    if (!canStaffAccessDelivery(role)) {
      return {
        status: 403,
        data: {
          error: 'Order actions require cashier staff role',
          errorAr: 'إجراءات الطلبات تتطلب دور الكاشير',
          code: 'STAFF_ACTION_DENIED',
        },
      };
    }

    if (!Number.isFinite(menuId) || menuId <= 0) {
      return {
        status: 400,
        data: {
          error: 'menuId is required',
          errorAr: 'menuId مطلوب',
          code: 'MENU_ID_REQUIRED',
        },
      };
    }

    const snap = await this.fetchStaffCallSnapshot(req, staffCallId);
    if (snap) {
      const presentedSnap = await this.presenter.presentOnePayload(req, snap);
      const entry = (presentedSnap.data.entry ??
        presentedSnap.data) as JsonRecord;
      const submission = this.submissionForRow(menuId, entry);
      const enriched = enrichRowWithSubmission(
        entry,
        submission
          ? {
              submittedAt: submission.submittedAt,
              submittedByStaffId: submission.submittedByStaffId,
              submittedByStaffName: submission.submittedByStaffName,
            }
          : null,
      );
      const pendingActions = new Set([
        'TABLE_CALL_CONFIRMED',
        'TABLE_CALL_CANCELLED',
      ]);
      if (
        pendingActions.has(action) &&
        !cashierCanActOnPending(enriched)
      ) {
        return {
          status: 409,
          data: {
            error: 'Order must be submitted by waiter before cashier action',
            errorAr: 'يجب على النادل إرسال الطلب قبل إجراء الكاشير',
            code: 'WAITER_SUBMISSION_REQUIRED',
          },
        };
      }
    }

    const activityLogId = await this.resolveActivityLogId(
      req,
      menuId,
      staffCallId,
    );

    if (activityLogId == null) {
      return {
        status: 409,
        data: {
          error: 'Activity log entry not found for this order',
          errorAr: 'لم يُعثر على سجل النشاط لهذا الطلب',
          code: 'ACTIVITY_LOG_NOT_FOUND',
        },
      };
    }

    return this.ensHttp.proxy({
      method: 'POST',
      path: `menus/${menuId}/activity-logs/${activityLogId}/actions`,
      req,
      body: { action },
    });
  }
}
