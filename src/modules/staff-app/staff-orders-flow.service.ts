import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { EnsHttpResult, EnsHttpService } from '../../infrastructure/ens-backend/ens-http.service';
import {
  canStaffViewDelivery,
  isCashierOnlyAction,
  StaffOrderActionType,
} from './staff-order-actions.util';
import { normalizeStaffUpstreamError } from './staff-order-errors.util';
import {
  StaffJobRole,
  normalizeStaffJobRole,
  staffJobRoleFromRequest,
} from './staff-job-role.util';
import {
  StaffOrderChannel,
  StaffOrderPresenterService,
  StaffPresentedDetailResult,
  StaffPresentedListResult,
  StaffPresentedOrderEntry,
} from './staff-order-presenter.service';
import { orderStatusFromAction } from './staff-order-status.util';

type Scope = 'active' | 'history';

@Injectable()
export class StaffOrdersFlowService {
  constructor(
    private readonly ensHttp: EnsHttpService,
    private readonly presenter: StaffOrderPresenterService,
  ) {}

  parseMenuId(query: Record<string, unknown>, body?: Record<string, unknown>): number {
    const raw = body?.menuId ?? query.menuId;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  async resolveRole(req: Request): Promise<StaffJobRole> {
    const fromJwt = staffJobRoleFromRequest(req);
    if (fromJwt === 'cashier') return 'cashier';

    try {
      const me = await this.ensHttp.proxy({
        method: 'GET',
        path: 'staff-auth/me',
        req,
      });
      const staff = (me.data as Record<string, unknown> | null)?.staff;
      if (staff && typeof staff === 'object') {
        const role = normalizeStaffJobRole(
          (staff as Record<string, unknown>).role,
        );
        if (role !== 'unknown') return role;
      }
    } catch {
      /* fall through */
    }

    return fromJwt === 'unknown' ? 'waiter' : fromJwt;
  }

  async listOrders(
    req: Request,
    query: Record<string, unknown>,
  ): Promise<StaffPresentedListResult> {
    const role = await this.resolveRole(req);
    const channel = this.parseChannel(query.channel);
    const scope = this.parseScope(query.scope);
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 50) || 50));
    const menuId = this.parseMenuId(query);

    if (channel === 'delivery' && !canStaffViewDelivery(role)) {
      return this.emptyList(role, channel, scope, page, limit);
    }

    if (menuId <= 0) {
      return this.emptyList(role, channel, scope, page, limit);
    }

    const upstream = await this.ensHttp.proxy({
      method: 'GET',
      path: `menus/${menuId}/activity-logs`,
      req,
      query: {
        page,
        limit,
        channel,
      },
    });

    const payload = (upstream.data ?? {}) as Record<string, unknown>;
    const rows = Array.isArray(payload.entries)
      ? payload.entries
      : Array.isArray(payload.calls)
        ? payload.calls
        : [];

    let presented = rows
      .map((row) =>
        this.presenter.presentListRow(
          row as Record<string, unknown>,
          role,
          channel,
        ),
      )
      .filter((entry): entry is StaffPresentedOrderEntry => entry != null);

    presented = await this.hydrateListEntries(req, menuId, role, channel, presented);

    const scoped = this.presenter.filterByScope(presented, scope);
    const total = Number(payload.total ?? scoped.length) || scoped.length;
    const totalPages =
      Number(payload.totalPages ?? Math.ceil(total / limit)) ||
      Math.max(1, Math.ceil(total / limit));

    return {
      staffJobRole: role,
      channel,
      scope,
      entries: scoped,
      total,
      page,
      limit,
      totalPages,
      capabilities: this.presenter.capabilitiesFor(role),
    };
  }

  async getOrder(
    req: Request,
    staffCallId: number,
    query: Record<string, unknown>,
  ): Promise<
    | { denied: true; httpStatus: number; data: Record<string, unknown> }
    | { denied: false; data: StaffPresentedDetailResult }
  > {
    const role = await this.resolveRole(req);
    const menuId = this.parseMenuId(query);
    const activityLogId = Number(query.activityLogId ?? 0);

    if (menuId <= 0 || staffCallId <= 0) {
      return {
        denied: true,
        httpStatus: 404,
        data: { error: 'Order not found', code: 'ORDER_NOT_FOUND' },
      };
    }

    let detailRaw: Record<string, unknown> | null = null;

    if (Number.isFinite(activityLogId) && activityLogId > 0) {
      const activity = await this.ensHttp.proxy({
        method: 'GET',
        path: `menus/${menuId}/activity-logs/${activityLogId}`,
        req,
      });
      const entry = (activity.data as Record<string, unknown> | null)?.entry;
      if (entry && typeof entry === 'object') {
        detailRaw = entry as Record<string, unknown>;
      }
    }

    if (!detailRaw) {
      detailRaw = await this.fetchTableCallRaw(req, staffCallId);
    }

    if (!detailRaw) {
      return {
        denied: true,
        httpStatus: 404,
        data: { error: 'Order not found', code: 'ORDER_NOT_FOUND' },
      };
    }

    const entry = this.presenter.presentDetail(detailRaw, role);
    if (!entry) {
      return {
        denied: true,
        httpStatus: 404,
        data: { error: 'Order not found', code: 'ORDER_NOT_FOUND' },
      };
    }

    if (entry.channel === 'delivery' && !canStaffViewDelivery(role)) {
      return {
        denied: true,
        httpStatus: 403,
        data: {
          error: 'Delivery orders are not available for your staff role',
          errorAr: 'طلبات التوصيل غير متاحة لدورك الوظيفي',
          code: 'STAFF_DELIVERY_DENIED',
        },
      };
    }

    const actions = Array.isArray(detailRaw.actions)
      ? (detailRaw.actions as Array<Record<string, unknown>>)
      : [];

    return {
      denied: false,
      data: {
        staffJobRole: role,
        entry,
        actions,
        capabilities: this.presenter.capabilitiesFor(role),
      },
    };
  }

  async postOrderAction(
    req: Request,
    staffCallId: number,
    action: string,
    menuId: number,
    activityLogId?: number,
  ): Promise<EnsHttpResult> {
    const role = await this.resolveRole(req);
    const normalizedAction = String(action ?? '').trim() as StaffOrderActionType;

    if (!menuId || staffCallId <= 0) {
      return {
        status: 400,
        data: {
          error: 'Invalid order payload',
          code: 'INVALID_ORDER',
        },
      };
    }

    if (isCashierOnlyAction(normalizedAction) && role !== 'cashier') {
      return {
        status: 403,
        data: {
          error: 'Order processing is available for cashier only',
          errorAr: 'معالجة الطلبات متاحة للكاشير فقط',
          code: 'STAFF_ACTION_DENIED',
        },
      };
    }

    const logId = await this.resolveActivityLogId(
      req,
      menuId,
      staffCallId,
      activityLogId,
    );

    let upstream: EnsHttpResult;

    if (
      role === 'cashier' &&
      logId > 0 &&
      (normalizedAction === 'TABLE_CALL_CONFIRMED' ||
        normalizedAction === 'TABLE_CALL_CANCELLED' ||
        normalizedAction === 'TABLE_CALL_PREPARED' ||
        normalizedAction === 'TABLE_CALL_DELIVERED')
    ) {
      upstream = await this.ensHttp.proxy({
        method: 'POST',
        path: `menus/${menuId}/activity-logs/${logId}/actions`,
        req,
        body: { action: normalizedAction },
      });
    } else if (
      normalizedAction === 'TABLE_CALL_CONFIRMED' ||
      normalizedAction === 'TABLE_CALL_CANCELLED'
    ) {
      const status = orderStatusFromAction(normalizedAction);
      upstream = await this.ensHttp.proxy({
        method: 'PATCH',
        path: `staff-auth/table-calls/${staffCallId}/status`,
        req,
        body: { status },
      });
    } else {
      return {
        status: 403,
        data: {
          error: 'Action not allowed for your staff role',
          errorAr: 'هذا الإجراء غير مسموح لدورك الوظيفي',
          code: 'STAFF_ACTION_DENIED',
        },
      };
    }

    if (upstream.status >= 400) {
      return normalizeStaffUpstreamError(upstream);
    }

    return this.presentOrderMutation(
      req,
      staffCallId,
      menuId,
      activityLogId,
    );
  }

  async getCapabilities(req: Request) {
    const role = await this.resolveRole(req);
    return {
      staffJobRole: role,
      capabilities: this.presenter.capabilitiesFor(role),
    };
  }

  async patchOrderItems(
    req: Request,
    staffCallId: number,
    menuId: number,
    items: unknown,
    activityLogId?: number,
  ): Promise<EnsHttpResult> {
    if (menuId <= 0 || staffCallId <= 0) {
      return {
        status: 400,
        data: {
          error: 'Invalid order payload',
          code: 'INVALID_ORDER',
        },
      };
    }

    const upstream = await this.ensHttp.proxy({
      method: 'PATCH',
      path: `staff-auth/table-calls/${staffCallId}/items`,
      req,
      body: { items },
    });

    if (upstream.status >= 400) {
      return normalizeStaffUpstreamError(upstream);
    }

    return this.presentOrderMutation(
      req,
      staffCallId,
      menuId,
      activityLogId,
    );
  }

  private async presentOrderMutation(
    req: Request,
    staffCallId: number,
    menuId: number,
    activityLogId?: number,
  ): Promise<EnsHttpResult> {
    const presented = await this.getOrder(req, staffCallId, {
      menuId,
      activityLogId: activityLogId ?? 0,
    });

    if (presented.denied) {
      return {
        status: presented.httpStatus,
        data: presented.data,
      };
    }

    return {
      status: 200,
      data: presented.data,
    };
  }

  private async hydrateListEntries(
    req: Request,
    menuId: number,
    role: StaffJobRole,
    channel: StaffOrderChannel,
    entries: StaffPresentedOrderEntry[],
  ): Promise<StaffPresentedOrderEntry[]> {
    if (entries.length === 0) return entries;

    const pendingIndex =
      channel === 'table'
        ? await this.fetchPendingTableCallsIndex(req)
        : new Map<number, Record<string, unknown>>();

    const sparse = entries.filter((entry) => entry.items.length === 0);
    const detailFetches = sparse
      .filter((entry) => !pendingIndex.has(entry.staffCallId))
      .slice(0, 20)
      .map(async (entry) => {
        const raw = await this.fetchTableCallRaw(req, entry.staffCallId);
        return { staffCallId: entry.staffCallId, raw };
      });

    const fetched = await Promise.all(detailFetches);
    const detailIndex = new Map<number, Record<string, unknown>>();
    for (const row of fetched) {
      if (row.raw) detailIndex.set(row.staffCallId, row.raw);
    }

    return entries.map((entry) => {
      const pending = pendingIndex.get(entry.staffCallId);
      if (pending) {
        return this.presenter.mergeCallHydration(entry, pending, role);
      }
      const detail = detailIndex.get(entry.staffCallId);
      if (detail) {
        return this.presenter.mergeCallHydration(entry, detail, role);
      }
      return entry;
    });
  }

  private async fetchPendingTableCallsIndex(
    req: Request,
  ): Promise<Map<number, Record<string, unknown>>> {
    const upstream = await this.ensHttp.proxy({
      method: 'GET',
      path: 'staff-auth/table-calls',
      req,
    });
    const payload = (upstream.data ?? {}) as Record<string, unknown>;
    const calls = Array.isArray(payload.calls) ? payload.calls : [];
    const index = new Map<number, Record<string, unknown>>();
    for (const call of calls) {
      if (!call || typeof call !== 'object') continue;
      const map = call as Record<string, unknown>;
      const id = Number(map.id ?? 0);
      if (Number.isFinite(id) && id > 0) {
        index.set(id, map);
      }
    }
    return index;
  }

  private async fetchTableCallRaw(
    req: Request,
    staffCallId: number,
  ): Promise<Record<string, unknown> | null> {
    const call = await this.ensHttp.proxy({
      method: 'GET',
      path: `staff-auth/table-calls/${staffCallId}`,
      req,
    });
    if (call.status >= 400) return null;

    const callBody = call.data as Record<string, unknown> | null;
    const callData =
      callBody?.call && typeof callBody.call === 'object'
        ? (callBody.call as Record<string, unknown>)
        : callBody;
    if (!callData || typeof callData !== 'object') return null;

    return {
      ...callData,
      orderId: callData.id ?? staffCallId,
      totalPrice: callData.orderTotal,
      items: callData.items,
      status: callData.status,
      actionDetails: [
        {
          status: callData.status,
          time: callData.at ?? callData.requestedAt,
        },
      ],
    };
  }

  private async resolveActivityLogId(
    req: Request,
    menuId: number,
    staffCallId: number,
    activityLogId?: number,
  ): Promise<number> {
    if (activityLogId && activityLogId > 0) return activityLogId;

    const upstream = await this.ensHttp.proxy({
      method: 'GET',
      path: `menus/${menuId}/activity-logs`,
      req,
      query: { page: 1, limit: 100 },
    });
    const payload = (upstream.data ?? {}) as Record<string, unknown>;
    const rows = Array.isArray(payload.entries)
      ? payload.entries
      : Array.isArray(payload.calls)
        ? payload.calls
        : [];

    for (const row of rows) {
      const map = row as Record<string, unknown>;
      if (Number(map.orderId) === staffCallId) {
        const id = Number(map.id);
        if (Number.isFinite(id) && id > 0) return id;
      }
    }

    return 0;
  }

  private parseChannel(raw: unknown): StaffOrderChannel {
    return String(raw ?? 'table').trim().toLowerCase() === 'delivery'
      ? 'delivery'
      : 'table';
  }

  private parseScope(raw: unknown): Scope {
    return String(raw ?? 'active').trim().toLowerCase() === 'history'
      ? 'history'
      : 'active';
  }

  private emptyList(
    role: StaffJobRole,
    channel: StaffOrderChannel,
    scope: Scope,
    page: number,
    limit: number,
  ): StaffPresentedListResult {
    return {
      staffJobRole: role,
      channel,
      scope,
      entries: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
      capabilities: this.presenter.capabilitiesFor(role),
    };
  }
}
