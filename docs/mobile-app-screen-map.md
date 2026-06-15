# Mobile Owner App — Screen & Action Map

**App:** `Mobile-app` (Flutter)  
**Router:** `lib/core/routing/app_router.dart`  
**Current API client:** `OwnerApiClient` → `{API_BASE_URL}/owner/*` (direct to Ensmenu backend today)  
**Target:** Flutter → NestJS Mobile Gateway only (see `nestjs-mobile-gateway-map.md`)

Legend:

| Column | Meaning |
|--------|---------|
| **Implemented** | Screen exists in Flutter today |
| **Pro UI** | Shown but blocked with upgrade dialog on free plan |
| **Planned** | In web dashboard / staff app but not in Flutter owner app yet |
| **Upstream (today)** | Path Flutter calls now (prefix `API_BASE_URL`, default `/api`) |
| **X-API-KEY** | Required on legacy web path; **No** on `/api/owner/*` |
| **NestJS proxy** | Yes = gateway should forward to upstream; Terminate = gateway handles locally |

---

## 1. Bootstrap & gates

### 1.1 SplashScreen

| Route | `/` |
| **Implemented** | Yes |

| Action | Upstream (today) | Auth | NestJS proxy |
|--------|------------------|------|--------------|
| Boot: restore session from secure storage | `GET /owner/auth/me` | Bearer | Yes |
| Redirect to login if no session | — | — | — |

**Errors:** 401 → login; invalid role (non-`user`) → logout + login.

---

### 1.2 LoginScreen

| Route | `/auth/login` |
| **Implemented** | Yes |

| Action | Upstream (today) | Body | Response | X-API-KEY | NestJS |
|--------|------------------|------|----------|-----------|--------|
| Login | `POST /owner/auth/login` | `{ email, password }` | `{ user, accessToken, refreshToken }` | No | Yes |
| Go to register | — | — | — | — | — |
| Forgot password | — | navigates | — | — | — |

**Errors:** 401 wrong credentials; 403 account locked.

---

### 1.3 RegisterScreen

| Route | `/auth/register` |
| **Implemented** | Yes |

| Action | Upstream (today) | Body | NestJS |
|--------|------------------|------|--------|
| Check email available | `GET /owner/auth/check-availability?email=` | — | Yes |
| Check phone available | `GET /owner/auth/check-availability?phoneNumber=` | — | Yes |
| Signup | `POST /owner/auth/signup` | `{ name, email, password, phoneNumber, restaurantName?, locale }` | Yes |
| Signup + auto login | above + `POST /owner/auth/login` | — | Yes |

---

### 1.4 ForgotPasswordScreen

| Route | `/auth/forgot-password` |

| Action | Upstream | Body | NestJS |
|--------|----------|------|--------|
| Send reset email | `POST /owner/auth/forgot-password` | `{ email, locale }` | Yes |

---

### 1.5 ResetPasswordScreen

| Route | `/auth/reset-password?token=` |

| Action | Upstream | Body | NestJS |
|--------|----------|------|--------|
| Reset password | `POST /owner/auth/reset-password` | `{ token, newPassword, locale }` | Yes |

---

### 1.6 SuspendedGateScreen

| Route | `/gates/suspended` |
| **Implemented** | Yes (no API; auth state flag) |

| Action | API | Notes |
|--------|-----|-------|
| Display suspended message | — | From `/owner/auth/me` user state |
| Logout | `POST /owner/auth/logout` | Yes |

---

### 1.7 ProfileGateScreen

| Route | `/gates/profile` |
| **Implemented** | Yes |

| Action | Upstream | Body | NestJS |
|--------|----------|------|--------|
| Load user | `GET /owner/auth/me` | — | Yes |
| Update profile (name, phone, restaurant) | `PUT /owner/user/profile` | partial user fields | Yes |

**Planned (web has, app partial):** VerifyKit phone verification before Pro payment — not wired in Flutter yet.

---

## 2. Menu list & creation

### 2.1 MenusListScreen

| Route | `/menus` |
| **Implemented** | Yes |

| Action | Upstream | Query/body | NestJS |
|--------|----------|------------|--------|
| List menus | `GET /owner/menus` | `locale` | Yes |
| Open menu hub | — | navigate | — |
| Create menu | navigates `/menus/create` | — | — |
| Delete menu (if UI) | `DELETE /owner/menus/:id` | — | Yes |
| Logout | `POST /owner/auth/logout` | `{ refreshToken }` | Yes |

**Response shape:** `{ menus: Menu[] }`

---

### 2.2 CreateMenuScreen

| Route | `/menus/create` |

| Action | Upstream | Body / notes | NestJS |
|--------|----------|--------------|--------|
| Check slug | `GET /owner/menus/check-slug` | `?slug=` | Yes |
| Upload logo | `POST /owner/upload` | multipart `file`, `type=logos` | Yes (multipart pass-through) |
| Create menu | `POST /owner/menus` | `{ nameAr, nameEn, logo, theme?, slug?, descriptionAr?, descriptionEn? }` | Yes |
| Load subscription limits | `GET /owner/user/subscription` | plan limits | Yes |

**Ownership:** JWT user; `checkMenuLimit` on backend.

---

## 3. Menu shell (bottom nav)

Shell: `MenuOwnerShell` — tabs Home, Categories, Items, Share, More.

### 3.1 MenuHubScreen (Home tab)

| Route | `/menus/:menuId` |

| Action | Upstream | NestJS | Pro / ownership |
|--------|----------|--------|-----------------|
| Load menu detail | `GET /owner/menus/:menuId` | Yes | Owner only |
| Load recent activity | `GET /owner/menus/:menuId/activity-logs?page=1&limit=5` | Yes | Owner only |
| Pull to refresh | same | Yes | — |
| Preview public menu | external URL | Terminate (build URL in gateway or app config) | — |
| Quick nav: categories/items/share | — | — | — |
| Quick action: design | navigate | — | — |
| Quick action: import | navigate | — | — |
| Quick action: analytics | **Pro UI** dialog only | Planned | Pro |
| QR with logo embed | uses menu.logo URL | image URL via gateway CDN | Pro for logo in QR |
| Upgrade card (free) | — | — | — |

---

### 3.2 CategoriesScreen

| Route | `/menus/:menuId/categories` |

| Action | Upstream | NestJS |
|--------|----------|--------|
| List categories (paginated, search) | `GET /owner/menus/:menuId/categories` | Yes |
| Toggle active / open edit | navigate | — |
| Delete category | `DELETE /owner/menus/:menuId/categories/:categoryId` | Yes |
| FAB → new category | navigate `/categories/new` | — |

**Query:** `page`, `limit`, `search`, `locale`

---

### 3.3 CategoryFormScreen

| Routes | `/menus/:menuId/categories/new`, `.../categories/:categoryId/edit` |

| Action | Upstream | Body | NestJS |
|--------|----------|------|--------|
| Load category (edit) | `GET /owner/menus/:menuId/categories/:categoryId` | — | Yes |
| Upload image | `POST /owner/upload` | `type=menu-items` or categories path | Yes |
| Create | `POST /owner/menus/:menuId/categories` | `{ nameAr, nameEn, image?, isActive?, sortOrder? }` | Yes |
| Update | `PUT /owner/menus/:menuId/categories/:categoryId` | partial | Yes |

---

### 3.4 ItemsScreen

| Route | `/menus/:menuId/items` |

| Action | Upstream | NestJS |
|--------|----------|--------|
| List items | `GET /owner/menus/:menuId/items` | Yes |
| Filter by category / available / search | query params | Yes |
| Delete item | `DELETE /owner/menus/:menuId/items/:itemId` | Yes |
| FAB → new item | navigate | — |

---

### 3.5 ItemFormScreen

| Routes | `/menus/:menuId/items/new`, `.../items/:itemId/edit` |

| Action | Upstream | Body | NestJS |
|--------|----------|------|--------|
| Load item | `GET /owner/menus/:menuId/items/:itemId` | — | Yes |
| Load categories for picker | `GET /owner/menus/:menuId/categories` | — | Yes |
| Upload image | `POST /owner/upload` | `type=menu-items` | Yes |
| Create | `POST /owner/menus/:menuId/items` | `{ nameAr, nameEn, price, categoryId?, category?, image?, ... }` | Yes |
| Update | `PUT /owner/menus/:menuId/items/:itemId` | partial | Yes |

---

### 3.6 MenuShareScreen (Share tab)

| Route | `/menus/:menuId/share` |

| Action | Upstream | NestJS |
|--------|----------|--------|
| Load menu (slug, logo, qr scan count) | `GET /owner/menus/:menuId` | Yes |
| Copy link / open browser | public URL helper | Config from gateway |
| Share QR image | local QR render | — |
| Download QR | local | — |

**Note:** QR scan count may come from menu detail or analytics — verify field on `MenuModel`.

---

### 3.7 MenuMoreScreen (More tab)

| Route | `/menus/:menuId/more` |

| Action | Navigate / API | Pro | NestJS |
|--------|----------------|-----|--------|
| Settings | `/menus/:id/settings` | — | — |
| Design | `/menus/:id/settings/design` | — | — |
| Media | `/menus/:id/settings/media` | — | — |
| Advertisements | `/menus/:id/advertisements` | **Pro UI** | — |
| AI Import | `/menus/:id/import` | — | — |
| Analytics | dialog only | **Pro UI** | Planned |
| Activity log | dialog only | **Pro UI** | Planned |
| Tables | dialog only | **Pro UI** | Planned |
| Table orders | dialog only | **Pro UI** | Planned |
| Staff | dialog only | **Pro UI** | Planned |
| Logout | `POST /owner/auth/logout` | — | Yes |

---

## 4. Settings & customization

### 4.1 MenuSettingsScreen

| Route | `/menus/:menuId/settings` |

| Action | Upstream | NestJS |
|--------|----------|--------|
| Load menu | `GET /owner/menus/:menuId` | Yes |
| Update name, logo, theme, active | `PUT /owner/menus/:menuId` | Yes |
| Upload logo | `POST /owner/upload` | Yes |
| Toggle menu status | `PUT /owner/menus/:id/status` | Yes |
| Delete menu | `DELETE /owner/menus/:id` | Yes |

---

### 4.2 MenuDesignScreen

| Route | `/menus/:menuId/settings/design` |

| Action | Upstream | Body | Pro check |
|--------|----------|------|-----------|
| Load customizations | `GET /owner/menus/:menuId/customizations` | — | — |
| Select template | `PUT /owner/menus/:menuId` | `{ theme }` | — |
| Save colors | `PUT /owner/menus/:menuId/customizations` | colors | Free OK |
| Save hero text | same | hero fields | **Backend Pro only** |
| Reset customizations | `DELETE /owner/menus/:menuId/customizations` | — | — |

**Free plan UI:** hero fields read-only in app; backend returns 403 if bypassed.

---

### 4.3 MenuMediaScreen

| Route | `/menus/:menuId/settings/media` |

| Action | Upstream | Body fields | NestJS |
|--------|----------|-------------|--------|
| Load | `GET /owner/menus/:menuId` | — | Yes |
| Save social/contact | `PUT /owner/menus/:menuId` | `socialFacebook`, `socialInstagram`, `socialTwitter`, `socialWhatsapp`, `addressAr`, `addressEn`, `phone` | Yes |

**Not in Flutter (web has):** `workingHours` JSON schedule — add in future screen.

---

## 5. Advertisements

### 5.1 MenuAdvertisementsScreen

| Route | `/menus/:menuId/advertisements` |
| **Pro:** UI gate on free; backend allows create without Pro middleware |

| Action | Upstream | NestJS |
|--------|----------|--------|
| List ads | `GET /owner/menus/:menuId/ads?page=&limit=` | Yes |
| Create ad | `POST /owner/menus/:menuId/ads` | Yes |
| Upload ad image | `POST /owner/upload` | `type=ads` | Yes |
| Toggle active | `PATCH /owner/ads/:adId/toggle` | Yes |
| Delete ad | `DELETE /owner/ads/:adId` | Yes |
| Update ad | `PUT /owner/ads/:adId` | **Partial in app** (create/toggle/delete implemented) |

**Create body:** `{ title, titleAr, content, contentAr, imageUrl?, linkUrl?, position? }`

---

## 6. AI menu import

### 6.1 MenuImportScreen

| Route | `/menus/:menuId/import` |

| Step | Action | Upstream | NestJS |
|------|--------|----------|--------|
| Upload | Pick camera/gallery | — | — |
| Analyze | `POST /owner/menus/:menuId/import` | multipart `file`, `locale` | **Terminate N8N at gateway** (recommended) |
| Review | Local edit categories/items | — | — |
| Save | `POST /owner/menus/:menuId/categories/bulk` | `{ categories: [...] }` | Yes |
| Can-use check | `GET /owner/menus/:menuId/categories/bulk/canuse` | optional | Yes |

**Import errors:** 503 webhook missing; 422 invalid AI response; 504 timeout.

---

## 7. Planned screens (web / staff app reference)

Not in Flutter owner app today; map for NestJS Phase 2+.

| Screen (proposed) | Web route | Staff app | Upstream owner path |
|-------------------|-----------|-----------|---------------------|
| Analytics | `/dashboard/:menu/analytics` | `analytics_screen.dart` | `GET /owner/menus/:id/analytics?period=` |
| Activity history | `/dashboard/:menu/history` | partial | activity-logs + resource fetches |
| Table orders | `/dashboard/:menu/orders` | `orders_tab_screen.dart` | `GET/POST .../activity-logs/.../actions` |
| Staff management | `/dashboard/:menu/staff` | services exist | `/owner/menus/:id/staff/*` |
| Tables | `/dashboard/:menu/table` | `tables_service.dart` | `/owner/menus/:id/tables/*` |
| Subscription | `/dashboard/:menu/subscription` | `subscription_screen.dart` | `/owner/user/subscription`, payment initiate |
| Personal profile | `/dashboard/:menu/personal` | `personal_profile_screen.dart` | `/owner/user/profile`, change-password |
| VerifyKit phone gate | modal in dashboard | — | `/owner/verifykit/*` |
| Working hours editor | media settings (web) | — | `PUT /owner/menus/:id` `workingHours` |

---

## 8. Screen count summary

| Status | Count |
|--------|-------|
| Implemented Flutter screens | 22 routes |
| Pro-gated UI only (no screen) | 5 features |
| Planned (web parity) | 8+ features |

---

## 9. Cross-reference

- API endpoint matrix: `nestjs-mobile-gateway-map.md`
- Sequence flows: `mobile-api-flow-map.md`
- Backend owner routes detail: `ens-new-menu-back-main/docs/mobile-owner-api-live-deployment-report.md`
