import { Injectable } from '@nestjs/common';
import { StaffJobRole } from './staff-job-role.util';
import {
  availableActionsForOrder,
  canStaffProcessOrders,
  canStaffViewDelivery,
  statusLabelFor,
  StaffOrderActionSpec,
} from './staff-order-actions.util';
import {
  isActiveStaffOrderStatus,
  resolveLatestOrderStatus,
  resolveListEntryStatus,
  StaffOrderStatus,
} from './staff-order-status.util';

export type StaffOrderChannel = 'table' | 'delivery';

export type StaffPresentedOrderItem = {
  menuItemId?: number | null;
  name: string;
  quantity: number;
  price: number;
  total: number;
  notes?: string | null;
  size?: Record<string, unknown> | null;
  variant?: Record<string, unknown> | null;
};

export type StaffPresentedOrderEntry = {
  id: string;
  staffCallId: number;
  activityLogId: number | null;
  channel: StaffOrderChannel;
  status: StaffOrderStatus;
  statusLabel: { en: string; ar: string };
  tableNumber: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  orderNotes: string | null;
  governorateId: number | null;
  governorateNameAr: string | null;
  governorateNameEn: string | null;
  deliveryFee: number | null;
  items: StaffPresentedOrderItem[];
  itemCount: number;
  totalPrice: number;
  createdAt: string | null;
  actionDetails: Array<{ status?: string; time?: string; waiterName?: string }>;
  availableActions: StaffOrderActionSpec[];
  canEditItems: boolean;
};

export type StaffOrderCapabilities = {
  staffJobRole: StaffJobRole;
  canProcessOrders: boolean;
  canViewDelivery: boolean;
  channels: StaffOrderChannel[];
};

export type StaffPresentedListResult = {
  staffJobRole: StaffJobRole;
  channel: StaffOrderChannel;
  scope: 'active' | 'history';
  entries: StaffPresentedOrderEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  capabilities: StaffOrderCapabilities;
};

export type StaffPresentedDetailResult = {
  staffJobRole: StaffJobRole;
  entry: StaffPresentedOrderEntry;
  actions: Array<Record<string, unknown>>;
  capabilities: StaffOrderCapabilities;
};

@Injectable()
export class StaffOrderPresenterService {
  capabilitiesFor(role: StaffJobRole): StaffOrderCapabilities {
    const channels: StaffOrderChannel[] = ['table'];
    if (canStaffViewDelivery(role)) {
      channels.push('delivery');
    }
    return {
      staffJobRole: role,
      canProcessOrders: canStaffProcessOrders(role),
      canViewDelivery: canStaffViewDelivery(role),
      channels,
    };
  }

  presentListRow(
    raw: Record<string, unknown>,
    role: StaffJobRole,
    channel: StaffOrderChannel,
  ): StaffPresentedOrderEntry | null {
    const entryChannel = this.resolveChannel(raw);
    if (entryChannel !== channel) return null;

    const staffCallId = this.parseStaffCallIdFromList(raw);
    if (staffCallId <= 0) return null;

    const activityLogId = this.parseActivityLogIdFromList(raw);
    const items = this.parseItems(raw.items);
    const actionDetails = this.parseActionDetails(raw.actionDetails);
    const status = resolveListEntryStatus({
      actionDetails,
      status: raw.status as string | undefined,
    });

    return this.buildEntry({
      raw,
      role,
      channel: entryChannel,
      staffCallId,
      activityLogId,
      status,
      items,
      actionDetails,
      actions: null,
    });
  }

  presentDetail(
    raw: Record<string, unknown>,
    role: StaffJobRole,
  ): StaffPresentedOrderEntry | null {
    const channel = this.resolveChannel(raw);
    const staffCallId = this.parseStaffCallId(raw);
    if (staffCallId <= 0) return null;

    const activityLogId = this.parseActivityLogId(raw);
    const order = (raw.order as Record<string, unknown> | undefined) ?? {};
    const actions = Array.isArray(raw.actions)
      ? (raw.actions as Array<Record<string, unknown>>)
      : [];
    const items = this.parseItems(raw.items ?? order.items);
    const actionDetails = actions.map((a) => ({
      status: a.status as string | undefined,
      time: a.time as string | undefined,
      waiterName: a.waiterName as string | undefined,
    }));
    const status = resolveLatestOrderStatus(
      actions,
      order as { status?: string },
    );

    return this.buildEntry({
      raw: { ...raw, ...order },
      role,
      channel,
      staffCallId,
      activityLogId,
      status,
      items,
      actionDetails,
      actions,
    });
  }

  private buildEntry(input: {
    raw: Record<string, unknown>;
    role: StaffJobRole;
    channel: StaffOrderChannel;
    staffCallId: number;
    activityLogId: number | null;
    status: StaffOrderStatus;
    items: StaffPresentedOrderItem[];
    actionDetails: Array<{
      status?: string;
      time?: string;
      waiterName?: string;
    }>;
    actions: Array<Record<string, unknown>> | null;
  }): StaffPresentedOrderEntry {
    const totalPrice = this.resolveTotalPrice(input.raw, input.items);
    const itemCount = input.items.reduce((sum, line) => sum + line.quantity, 0);
    const availableActions = availableActionsForOrder(
      input.status,
      input.role,
    );
    const canEditItems =
      input.role === 'cashier' &&
      (input.status === 'pending' || input.status === 'confirmed') &&
      itemCount > 0;

    return {
      id: String(input.activityLogId ?? input.staffCallId),
      staffCallId: input.staffCallId,
      activityLogId: input.activityLogId,
      channel: input.channel,
      status: input.status,
      statusLabel: statusLabelFor(input.status),
      tableNumber: this.stringOrNull(input.raw.tableNumber),
      customerName: this.stringOrNull(input.raw.customerName),
      customerPhone: this.stringOrNull(input.raw.customerPhone),
      customerAddress: this.stringOrNull(input.raw.customerAddress),
      orderNotes: this.stringOrNull(input.raw.orderNotes),
      governorateId: this.numberOrNull(input.raw.governorateId),
      governorateNameAr: this.stringOrNull(input.raw.governorateNameAr),
      governorateNameEn: this.stringOrNull(input.raw.governorateNameEn),
      deliveryFee: this.numberOrNull(input.raw.deliveryFee),
      items: input.items,
      itemCount,
      totalPrice,
      createdAt: this.resolveCreatedAt(input.actionDetails, input.raw),
      actionDetails: input.actionDetails,
      availableActions,
      canEditItems,
    };
  }

  filterByScope(
    entries: StaffPresentedOrderEntry[],
    scope: 'active' | 'history',
  ): StaffPresentedOrderEntry[] {
    if (scope === 'active') {
      return entries.filter((entry) => isActiveStaffOrderStatus(entry.status));
    }
    return entries.filter((entry) => !isActiveStaffOrderStatus(entry.status));
  }

  private resolveChannel(raw: Record<string, unknown>): StaffOrderChannel {
    const typeRaw = String(raw.type ?? '')
      .trim()
      .toLowerCase();
    if (typeRaw === 'delivery') return 'delivery';
    const table = String(raw.tableNumber ?? '')
      .trim()
      .toLowerCase();
    if (table === 'delivery') return 'delivery';
    return 'table';
  }

  private parseStaffCallIdFromList(raw: Record<string, unknown>): number {
    const orderId = Number(raw.orderId ?? 0);
    if (Number.isFinite(orderId) && orderId > 0) return orderId;
    return this.parseStaffCallId(raw);
  }

  private parseActivityLogIdFromList(raw: Record<string, unknown>): number | null {
    const id = Number(raw.id ?? 0);
    const orderId = Number(raw.orderId ?? 0);
    if (Number.isFinite(id) && id > 0 && orderId > 0 && id !== orderId) {
      return id;
    }
    return null;
  }

  private parseStaffCallId(raw: Record<string, unknown>): number {
    const fromOrderId = Number(raw.orderId ?? raw.staffCallId ?? 0);
    if (Number.isFinite(fromOrderId) && fromOrderId > 0) return fromOrderId;
    const fromId = Number(raw.id ?? 0);
    return Number.isFinite(fromId) && fromId > 0 ? fromId : 0;
  }

  private parseActivityLogId(raw: Record<string, unknown>): number | null {
    const fromList = this.parseActivityLogIdFromList(raw);
    if (fromList != null) return fromList;
    const id = Number(raw.id ?? 0);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  private parseItems(raw: unknown): StaffPresentedOrderItem[] {
    if (!Array.isArray(raw)) return [];
    const items: StaffPresentedOrderItem[] = [];
    for (const line of raw) {
      if (!line || typeof line !== 'object') continue;
      const map = line as Record<string, unknown>;
      const quantity = Math.max(1, Number(map.quantity ?? 1) || 1);
      const price = Number(map.price ?? 0) || 0;
      const total = Number(map.total ?? price * quantity) || price * quantity;
      const name = String(map.name ?? 'Item').trim() || 'Item';
      items.push({
        menuItemId:
          map.menuItemId != null ? Number(map.menuItemId) || null : null,
        name,
        quantity,
        price,
        total,
        notes: this.stringOrNull(map.notes),
        size:
          map.size && typeof map.size === 'object'
            ? (map.size as Record<string, unknown>)
            : null,
        variant:
          map.variant && typeof map.variant === 'object'
            ? (map.variant as Record<string, unknown>)
            : null,
      });
    }
    return items;
  }

  private parseActionDetails(raw: unknown) {
    if (!Array.isArray(raw)) return [];
    return raw.map((detail) => {
      const map = detail as Record<string, unknown>;
      return {
        status: map.status as string | undefined,
        time: map.time as string | undefined,
        waiterName: map.waiterName as string | undefined,
      };
    });
  }

  private resolveTotalPrice(
    raw: Record<string, unknown>,
    items: StaffPresentedOrderItem[],
  ): number {
    const candidates = [
      raw.totalPrice,
      raw.orderTotal,
      (raw.order as Record<string, unknown> | undefined)?.orderTotal,
    ];
    for (const value of candidates) {
      const num = Number(value);
      if (Number.isFinite(num) && num > 0) return num;
    }
    const computed = items.reduce((sum, line) => sum + line.total, 0);
    return computed > 0 ? computed : 0;
  }

  private resolveCreatedAt(
    actionDetails: Array<{ time?: string }>,
    raw: Record<string, unknown>,
  ): string | null {
    if (actionDetails.length > 0) {
      const first = actionDetails.find((detail) => detail.time)?.time;
      if (first) return first;
    }
    return this.stringOrNull(raw.createdAt ?? raw.updatedAt ?? raw.at);
  }

  private stringOrNull(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text.length > 0 ? text : null;
  }

  private numberOrNull(value: unknown): number | null {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
}
