export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  ensBackendUrl: process.env.ENS_BACKEND_URL?.replace(/\/$/, ''),
  assetPublicBaseUrl: process.env.ASSET_PUBLIC_BASE_URL?.replace(/\/$/, ''),
  corsOrigins: process.env.CORS_ORIGINS ?? '*',
  /** Access-token secret only — never use refresh secret for verification. */
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
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
  requestJsonLimit: process.env.REQUEST_JSON_LIMIT ?? '1mb',
  requestUrlencodedLimit: process.env.REQUEST_URLENCODED_LIMIT ?? '1mb',
  upstreamMaxContentLengthBytes: parseInt(
    process.env.UPSTREAM_MAX_CONTENT_LENGTH_BYTES ??
      String(15 * 1024 * 1024),
    10,
  ),
  /** Number of reverse-proxy hops trusted for client IP (0 = trust none). */
  trustProxyHops: parseInt(
    process.env.TRUST_PROXY_HOPS ??
      ((process.env.NODE_ENV ?? 'development') === 'production' ? '1' : '0'),
    10,
  ),
  pexelsApiKey: process.env.PEXELS_API_KEY,
  /** Server-only Places/Geocoding key — never expose to Flutter. */
  googleMapsServerApiKey: process.env.GOOGLE_MAPS_SERVER_API_KEY,
  mapsUpstreamTimeoutMs: parseInt(
    process.env.MAPS_UPSTREAM_TIMEOUT_MS ?? '8000',
    10,
  ),
  throttleMapsTtlMs: parseInt(process.env.THROTTLE_MAPS_TTL_MS ?? '60000', 10),
  throttleMapsLimit: parseInt(process.env.THROTTLE_MAPS_LIMIT ?? '30', 10),
  throttleMapsOwnerTtlMs: parseInt(
    process.env.THROTTLE_MAPS_OWNER_TTL_MS ?? '60000',
    10,
  ),
  throttleMapsOwnerLimit: parseInt(
    process.env.THROTTLE_MAPS_OWNER_LIMIT ?? '30',
    10,
  ),
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
  // Owner Android app version check (public, no DB)
  appAndroidLatestVersion: process.env.APP_ANDROID_LATEST_VERSION ?? '1.0.0',
  appAndroidMinimumVersion: process.env.APP_ANDROID_MINIMUM_VERSION ?? '1.0.0',
  appAndroidForceUpdate: process.env.APP_ANDROID_FORCE_UPDATE ?? 'false',
  appAndroidStoreUrl:
    process.env.APP_ANDROID_STORE_URL ??
    'https://play.google.com/store/apps/details?id=com.ensmenu.ens_owner_app',
  appAndroidReleaseNotes: process.env.APP_ANDROID_RELEASE_NOTES ?? '',
  throttleAppVersionTtlMs: parseInt(
    process.env.THROTTLE_APP_VERSION_TTL_MS ?? '60000',
    10,
  ),
  throttleAppVersionLimit: parseInt(
    process.env.THROTTLE_APP_VERSION_LIMIT ?? '30',
    10,
  ),
});
