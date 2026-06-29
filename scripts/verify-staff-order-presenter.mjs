#!/usr/bin/env node
/**
 * Verify deployed mobapi returns web-shaped entries[] from StaffOrderPresenterService.
 *
 * Usage:
 *   STAFF_MENU_SLUG=your-menu STAFF_EMAIL=you@example.com STAFF_PASSWORD=secret \
 *     node scripts/verify-staff-order-presenter.mjs
 *
 * Optional:
 *   MOBAPI_BASE_URL=https://mobapi.ensbot.net (default)
 */

const baseUrl = (process.env.MOBAPI_BASE_URL || 'https://mobapi.ensbot.net').replace(
  /\/$/,
  '',
);
const menuSlug = process.env.STAFF_MENU_SLUG?.trim();
const email = process.env.STAFF_EMAIL?.trim();
const password = process.env.STAFF_PASSWORD;

if (!menuSlug || !email || !password) {
  console.error(
    'Set STAFF_MENU_SLUG, STAFF_EMAIL, and STAFF_PASSWORD to verify live mobapi.',
  );
  process.exit(1);
}

async function main() {
  const loginRes = await fetch(`${baseUrl}/mobile/v1/staff/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ menuSlug, email, password }),
  });
  const loginBody = await loginRes.json();
  const token =
    loginBody.accessToken ||
    loginBody.access_token ||
    loginBody.token ||
    loginBody.data?.accessToken;

  if (!token) {
    console.error('Login failed:', loginRes.status, loginBody);
    process.exit(1);
  }

  const ordersRes = await fetch(`${baseUrl}/mobile/v1/staff/orders?limit=5`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const presenterHeader = ordersRes.headers.get('x-staff-order-presenter');
  const enrichmentHeader = ordersRes.headers.get('x-staff-order-enrichment');
  const ordersBody = await ordersRes.json();

  const calls = Array.isArray(ordersBody.calls) ? ordersBody.calls : [];
  const entries = Array.isArray(ordersBody.entries) ? ordersBody.entries : [];
  const hasEntriesKey = Object.prototype.hasOwnProperty.call(ordersBody, 'entries');

  console.log('--- mobapi staff orders presenter check ---');
  console.log('URL:', `${baseUrl}/mobile/v1/staff/orders`);
  console.log('HTTP status:', ordersRes.status);
  console.log('X-Staff-Order-Presenter:', presenterHeader ?? '(missing)');
  console.log('X-Staff-Order-Enrichment:', enrichmentHeader ?? '(missing)');
  console.log('Has entries[] key:', hasEntriesKey);
  console.log('entries.length:', entries.length);
  console.log('calls.length:', calls.length);

  if (entries.length > 0) {
    const sample = entries[0];
    console.log('Sample entry keys:', Object.keys(sample).sort().join(', '));
    console.log('Sample orderId:', sample.orderId);
    console.log('Sample lastAction:', sample.lastAction);
    console.log('Sample customerPhone:', sample.customerPhone ?? '(null)');
    console.log('Sample governorateNameEn:', sample.governorateNameEn ?? '(null)');
    console.log('Sample customerAddress:', sample.customerAddress ?? '(null)');
    console.log('Sample orderNotes:', sample.orderNotes ?? '(null)');
  }

  const ok =
    ordersRes.ok &&
    hasEntriesKey &&
    presenterHeader === 'v1' &&
    (calls.length === 0 || entries.length === calls.length);

  if (ok) {
    console.log('\nPASS: Gateway presenter is active and entries[] aligns with calls[].');
    process.exit(0);
  }

  console.error('\nFAIL:');
  if (presenterHeader !== 'v1') {
    console.error('- Deploy latest ensmenu-mobile-gateway (missing X-Staff-Order-Presenter: v1).');
  }
  if (!hasEntriesKey) {
    console.error('- Response has no entries[] — outdated gateway build.');
  }
  if (calls.length > 0 && entries.length !== calls.length) {
    console.error(
      `- entries.length (${entries.length}) != calls.length (${calls.length}).`,
    );
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
