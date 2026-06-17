export const NOTIFICATION_EVENTS = [
  'new_table_order',
  'staff_call',
  'payment_completed',
  'subscription_expiring',
  'menu_import_completed',
  'system_alert',
] as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export function isNotificationEvent(value: string): value is NotificationEvent {
  return (NOTIFICATION_EVENTS as readonly string[]).includes(value);
}
