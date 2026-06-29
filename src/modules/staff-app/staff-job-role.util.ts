import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { verifyAccessTokenLocally } from '../../common/utils/jwt-payload.util';
import { resolveOrderType } from './staff-order-delivery-enrichment.util';

export type StaffJobRole = 'waiter' | 'cashier' | 'unknown';

export function normalizeStaffJobRole(raw: unknown): StaffJobRole {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (value === 'cashier' || value === 'casher') return 'cashier';
  if (value === 'waiter') return 'waiter';
  return 'unknown';
}

/** Job role from staff JWT (`staffJobRole` claim). Defaults to waiter when absent. */
export function resolveStaffJobRoleFromRequest(
  req: Request,
  configService: ConfigService,
): StaffJobRole {
  const user = verifyAccessTokenLocally(req, configService);
  if (!user) return 'unknown';

  const fromJwt = normalizeStaffJobRole(user.staffJobRole);
  if (fromJwt !== 'unknown') return fromJwt;

  return 'waiter';
}

export function canStaffAccessDelivery(jobRole: StaffJobRole): boolean {
  return jobRole === 'cashier';
}

export function isDeliveryStaffCall(call: Record<string, unknown>): boolean {
  return resolveOrderType(call) === 'delivery';
}

export function filterTableOnlyStaffCalls<T extends Record<string, unknown>>(
  calls: T[],
): T[] {
  return calls.filter((call) => !isDeliveryStaffCall(call));
}
