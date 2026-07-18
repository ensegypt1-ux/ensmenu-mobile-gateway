export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  ensBackendUrl: process.env.ENS_BACKEND_URL?.replace(/\/$/, ''),
  assetPublicBaseUrl: process.env.ASSET_PUBLIC_BASE_URL?.replace(/\/$/, ''),
  corsOrigins: process.env.CORS_ORIGINS ?? '*',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET,
  jwtSecret: process.env.JWT_SECRET,
  secretKey: process.env.SECRET_KEY ?? process.env.ENCRYPTION_KEY,
  /** Compensates clock skew vs ENS_BACKEND_URL (backend rejects x-api-key after ~60s). */
  apiKeyTimeOffsetSeconds: parseInt(
    process.env.API_KEY_TIME_OFFSET_SECONDS ?? '30',
    10,
  ),
  publicMenuHostSuffix: process.env.PUBLIC_MENU_HOST_SUFFIX ?? '.ensmenu.com',
  upstreamDebugLog:
    process.env.UPSTREAM_DEBUG_LOG === 'true' ||
    (process.env.UPSTREAM_DEBUG_LOG !== 'false' &&
      (process.env.NODE_ENV ?? 'development') !== 'production'),
  upstreamTimeoutMs: parseInt(process.env.UPSTREAM_TIMEOUT_MS ?? '30000', 10),
  importTimeoutMs: parseInt(process.env.IMPORT_TIMEOUT_MS ?? '90000', 10),
  uploadMaxMb: parseInt(process.env.UPLOAD_MAX_MB ?? '10', 10),
  pexelsApiKey: process.env.PEXELS_API_KEY,
  n8nMenuImportWebhook: process.env.N8N_MENU_IMPORT_WEBHOOK,
  firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
  firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
  internalNotificationsSecret: process.env.INTERNAL_NOTIFICATIONS_SECRET,
  notificationDevicesStorePath:
    process.env.NOTIFICATION_DEVICES_STORE_PATH ??
    './data/notification-devices.json',
  throttleTtlMs: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
  throttleLimit: parseInt(process.env.THROTTLE_LIMIT ?? '120', 10),
  throttleAuthTtlMs: parseInt(process.env.THROTTLE_AUTH_TTL_MS ?? '60000', 10),
  throttleAuthLimit: parseInt(process.env.THROTTLE_AUTH_LIMIT ?? '20', 10),
  throttleSensitiveTtlMs: parseInt(
    process.env.THROTTLE_SENSITIVE_TTL_MS ?? '60000',
    10,
  ),
  throttleSensitiveLimit: parseInt(
    process.env.THROTTLE_SENSITIVE_LIMIT ?? '40',
    10,
  ),
});
