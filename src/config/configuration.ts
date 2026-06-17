export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  ensBackendUrl: process.env.ENS_BACKEND_URL?.replace(/\/$/, ''),
  assetPublicBaseUrl: process.env.ASSET_PUBLIC_BASE_URL?.replace(/\/$/, ''),
  corsOrigins: process.env.CORS_ORIGINS ?? '*',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET,
  jwtSecret: process.env.JWT_SECRET,
  secretKey: process.env.SECRET_KEY ?? process.env.ENCRYPTION_KEY,
  publicMenuHostSuffix: process.env.PUBLIC_MENU_HOST_SUFFIX ?? '.ensmenu.com',
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
});
