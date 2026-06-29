import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { EnsHttpService } from '../../infrastructure/ens-backend/ens-http.service';
import {
  StaffOrderPresenterService,
  StaffOrderPresentResult,
} from './staff-order-presenter.service';
import {
  canStaffAccessDelivery,
  resolveStaffJobRoleFromRequest,
  type StaffJobRole,
} from './staff-job-role.util';
import { activityLogIdFromRow } from './staff-order-delivery-enrichment.util';

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

@Injectable()
export class StaffOrdersFlowService {
  constructor(
    private readonly ensHttp: EnsHttpService,
    private readonly presenter: StaffOrderPresenterService,
    private readonly configService: ConfigService,
  ) {}

  resolveRole(req: Request): StaffJobRole {
    return resolveStaffJobRoleFromRequest(req, this.configService);
  }

  usesActivityLogs(role: StaffJobRole, menuId: number): boolean {
    return canStaffAccessDelivery(role) && Number.isFinite(menuId) && menuId > 0;
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

  /** Cashier: mirrors web `GET /menus/:menuId/activity-logs`. Waiter: staff-auth table-calls. */
  async listOrders(
    req: Request,
    query: Record<string, unknown>,
    upstreamPath: 'staff-auth/table-calls' | 'staff-auth/table-calls/history',
  ): Promise<StaffOrderPresentResult> {
    const role = this.resolveRole(req);
    const menuId = this.parseMenuId(query);

    if (this.usesActivityLogs(role, menuId)) {
      const result = await this.ensHttp.proxy({
        method: 'GET',
        path: `menus/${menuId}/activity-logs`,
        req,
        query: this.pickActivityQuery(query),
      });

      if (result.status >= 200 && result.status < 300 && result.data) {
        return {
          data: result.data as JsonRecord,
          enrichment: 'activity-log',
          staffJobRole: role,
          httpStatus: result.status,
        };
      }

      return {
        data: (result.data ?? {}) as JsonRecord,
        enrichment: 'staff-auth-only',
        staffJobRole: role,
        httpStatus: result.status,
      };
    }

    const result = await this.ensHttp.proxy({
      method: 'GET',
      path: upstreamPath,
      req,
      query,
    });

    if (result.status >= 200 && result.status < 300) {
      const presented = await this.presenter.presentListPayload(req, result.data);
      return { ...presented, httpStatus: result.status };
    }

    return {
      data: (result.data ?? {}) as JsonRecord,
      enrichment: 'staff-auth-only',
      staffJobRole: role,
      httpStatus: result.status,
    };
  }

  /** Cashier detail: prefer full activity-log entry (web `?entry=` modal). */
  async getOrder(
    req: Request,
    staffCallId: number,
    menuIdFromQuery: number,
  ): Promise<StaffOrderPresentResult> {
    const role = this.resolveRole(req);
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
            return {
              data: { entry: listEntry, ...staffCall, entries: [listEntry] },
              enrichment: 'activity-log-detail',
              staffJobRole: role,
            };
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
      return this.presenter.presentOnePayload(req, result.data);
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

  /** Mirrors web `POST /menus/:menuId/activity-logs/:entryId/actions`. */
  async postOrderAction(
    req: Request,
    staffCallId: number,
    action: string,
    menuId: number,
  ) {
    const role = this.resolveRole(req);
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
