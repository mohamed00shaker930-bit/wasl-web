# wasl-web rewrite guide (Supabase → wasl-api)

Every file that imported `@/integrations/supabase/client` must be rewritten to call the REST API. Read this fully before editing.

## Conventions
- HTTP: `import { http, errorMessage, ApiError } from "@/api/client"`. `http.get(path, query?)`, `http.post(path, body?)`, `http.put`, `http.patch`, `http.del(path, body?)`, `http.upload(path, file)`. Paths are relative to `/api` (e.g. `http.get("/me/orders")`). Throws `ApiError { status, code, details, message }`; `message` is already Arabic. Use `toast.error(errorMessage(e))`.
- Auth: `import { auth, useAuth } from "@/auth/store"`. `useAuth()` → `{ status: "loading"|"anon"|"authed", me }`; `me.user.id`, `me.user.name`, `me.user.phone`, `me.roles`, `me.perms`, `me.super`, `me.is_staff`, `me.store` (merchant's store row or null). `auth.logout()`, `auth.role(me)` → "merchant"|"customer"|null, `auth.isAdmin(me)`, `auth.hasPerm("users.create")`. Route guards: `beforeLoad: () => requireAuth()` / `requireMerchant()` / `requireAdmin()` from `@/auth/guards` (the parent routes `/merchant` and `/admin` already guard their children; child routes need no guard). Never call `supabase.auth.getSession()`; use `useAuth()` or `auth.state.me`.
- Replace `supabase.auth.signOut()` with `await auth.logout(); navigate({ to: "/auth" })`.
- Realtime: `useNotifications()` in `@/lib/notifications` already subscribes to SSE and invalidates query keys `notifications`, `orders`, `my-orders`, `merchant-orders`, `credit`, `merchant-credit`, `wallet`. Prefer those query keys. Keep existing `refetchInterval`s as fallback.
- Files/images: instead of base64 in `image_url` or Supabase Storage: `http.upload("/merchant/products/:id/image", file)` → `{ url }`; `http.upload("/files/custom-requests", file)` → `{ url }`; admin: `http.upload("/admin/catalog/images", file)`, `http.upload("/admin/banners/images", file)`. Never send `data:` URLs (the API rejects them).
- Field naming: **API responses are camelCase** (`createdAt`, `storeId`, `paymentMethod`, `creditStatus`, `returnStatus`, `imageUrl`, `inStock`, `readAt`, `businessName`, `accountStatus`…). Request bodies are snake_case (`store_id`, `payment_method`, `landmark_text`). Numeric columns arrive as strings (`"1900.00"`) — wrap with `Number()`. Timestamps are ISO strings. Update JSX field accesses accordingly; do not invent fields — check `../wasl-api/openapi.json` or the controller/service in `../wasl-api/src/modules/<module>/`.
- Remove `head:` blocks? No — keep them (harmless). Remove any `ssr:` option. Do not add new dependencies. Keep all Arabic strings and the UI structure; only the data layer changes. Do not touch `src/components/ui/*`.
- Google Maps env: use `import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY` (rename from `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`; drop the tracking id / `channel` param).
- Offline POS: `@/lib/offline-db` and `@/lib/pos-outbox` are already migrated; `merchant.pos.tsx` must load products/customers from `http.get("/merchant/pos/snapshot")` (`{ products, customers: [{id,name,phone,kind:"registered"|"pending",accountId,balance}] }`) and keep writing to IndexedDB + `enqueue()` exactly as before. The sale envelope shape is unchanged.

## Endpoint map (old → new)
| Old | New |
|---|---|
| `profiles` select own / update | `GET /me/profile` → profile row; `PATCH /me/profile { name, city, district, address, business_name, business_category_id }` |
| `rpc delete_my_account` | `DELETE /me` |
| `locations` | `GET /me/locations`, `POST /me/locations { label, landmark_text, phone?, lat?, lng? }`, `PUT /me/locations/:id`, `DELETE /me/locations/:id` |
| `favorites` | see `@/lib/favorites` (`useFavorites`, `useToggleFavorite`, `useFavoritesPayload` → `{favorites, stores, products}`) |
| `notifications` | `@/lib/notifications` (`useNotifications`, `markRead`, `markAllRead`) |
| `stores` (active list) | `GET /stores?lat&lng&q&category_id` → rows with `distanceKm`; `GET /stores/:id`; `GET /stores/:id/categories`; `GET /stores/:id/products?category_id&q&barcode` (each product has `offer: {discountPrice, endsAt, remaining} | null`); `GET /stores/:id/offers` |
| `banners` (active) | `GET /banners` |
| `business_categories` | `GET /business-categories` |
| `app_settings` public keys | `GET /settings/public` → `{ delivery_fee, min_order, max_credit, support_phone, wallets_enabled, credit_enabled, ewallets_enabled }` |
| `catalog_categories` / `catalog_items` | `GET /catalog/categories` (with `itemsCount`), `GET /catalog/items?category_id&q&page&limit&sort` → `{items,total,page,limit}` |
| cart checkout (orders + order_items + pay_order_with_wallet) | ONE call: `POST /orders { store_id, items:[{product_id, qty, note?}], payment_method: "cash"|"credit"|"wallet"|"jeeb"|"jawali"|"hasab"|"onecash", location:{landmark, phone?, label?, lat?, lng?}, note?, wallet_ref? }` → order row + `items`. Do NOT send prices/total. Keep `validateCheckout` for pre-flight UX only. |
| customer orders | `GET /me/orders?status&limit` → orders with `items` and `store:{id,name}`; `GET /me/orders/:id`; `POST /me/orders/:id/cancel`; `POST /me/orders/:id/return { reason }` (was rpc customer_request_return); `POST /me/orders/:id/rating { stars, comment? }` (was insert ratings) |
| custom requests (customer) | `GET /me/custom-requests` → `[{ r: {...}, storeName }]`, `POST /me/custom-requests { store_id, name, description?, qty, image_url? }`, `POST /me/custom-requests/:id/accept` / `/reject` |
| wallet | `GET /me/wallet` → `{ balance:number }` (creates it if missing; was rpc ensure_wallet), `GET /me/wallet/transactions?limit`, `POST /me/wallet/topups { amount, method:"jeeb"|"jawali"|"hasab"|"onecash", reference?, note? }` |
| credit (customer) | `GET /me/credit` → `[{ id, storeId, balance:number, store:{id,name}, transactions:[...], ledger_consistent }]`; `POST /me/credit/transactions/:id/respond { approve }` (was rpc customer_respond_credit) |
| merchant store | `GET /merchant/store`, `PATCH /merchant/store { name, area, delivery_info, phone, image_url, is_open, lat, lng, business_category_id }`, `POST /merchant/store/image` (upload); dashboard tiles: `GET /merchant/dashboard` → `{ new_orders, today_orders, today_revenue, pending_returns, credit_outstanding }` |
| merchant categories/products/offers | `GET/POST /merchant/categories`, `PUT/DELETE /merchant/categories/:id`; `GET/POST /merchant/products`, `PATCH/DELETE /merchant/products/:id` (body: name, price, category_id, barcode, in_stock, image_url, lib_category, main_section, subcategory), `POST /merchant/products/:id/image` (upload), `POST /merchant/products/import-from-catalog { catalog_item_ids }`; `GET/POST /merchant/offers`, `PATCH/DELETE /merchant/offers/:id` (body: product_id, discount_price, starts_at?, ends_at?, max_qty?, active?) |
| merchant orders | `GET /merchant/orders?status&from&to&channel&limit` (with `items`), `GET /merchant/orders/:id`, `GET /merchant/orders/:id/customer` → `{name, phone}` (was rpc get_order_customer), `PATCH /merchant/orders/:id/status { status }` (accepted/preparing/out_for_delivery/delivered/declined; API enforces transitions), `POST /merchant/orders/:id/credit-decision { approve }` (credit orders must be decided before accepting), `POST /merchant/orders/:id/return-decision { approve }`, `POST /merchant/orders/:id/customer-rating { stars, comment? }` |
| merchant credit | `GET /merchant/credit/accounts` → `[{ id, customerId, balance, customerName, customerPhone }]` (was rpc get_credit_customer per row), `GET /merchant/credit/accounts/:id` (+ `transactions`), `POST /merchant/credit/accounts { customer_id }`, `POST /merchant/credit/accounts/:id/transactions { type:"payment"|"charge", amount, note? }`, `POST /merchant/credit/transactions/:id/cancel`, `GET /merchant/customers/search?q=` → `[{id,name,phone,kind}]` (was rpc search_customers_by_name), `GET/POST /merchant/pending-customers { name, phone }` |
| merchant custom requests | `GET /merchant/custom-requests` → `[{ r, customerName }]`, `POST /merchant/custom-requests/:id/quote { price, note? }`, `POST /merchant/custom-requests/:id/reject` |
| merchant returns | `GET /merchant/orders?status=…` filtered client-side by `returnStatus !== "none"`, decision via `/return-decision` |
| merchant reports | `GET /merchant/reports/summary?from&to` → `{ orders, delivered, cancelled, revenue, average_order, online, in_store, by_payment:{[method]:{count,total}}, top_products:[{name,qty,total}], commission }`; `GET /merchant/reports/orders?from&to` for CSV export |
| POS | `GET /merchant/pos/snapshot?since`, outbox unchanged (`@/lib/pos-outbox`) |
| admin overview counts | `GET /admin/overview` |
| rpc admin_kpis | `GET /admin/kpis?from&to&grain=day|week|month` → `{ summary:{orders:{value,previous,delta_pct},delivered,cancelled,revenue,commission,customers,returns_pending}, by_channel, by_status, by_payment:[{key,orders,total}], series:[{bucket,orders,revenue,commission}], top_stores, top_products, customers:{new_customers,pending_accounts,active_accounts}, credit:{outstanding,charged,collected,collection_rate,pending_entries}, attention:{...}, ratings:{avg_stars,ratings} }` |
| admin analytics (5000 orders client-side) | `GET /admin/orders?status&store_id&from&to&limit=5000` → `[{ o: order, storeName }]`; stores via `GET /admin/stores`; keep client-side aggregation/xlsx export |
| rpc admin_list_users | `GET /admin/users?kind=all|customers|merchants|staff&role&search&status&category_slug&limit&offset` → `{ items:[profile + roles[] + stores[]], total }` |
| rpc admin_get_user_detail | `GET /admin/users/:id` → `{ profile, user, roles, perms, stores, wallet }` |
| rpc admin_update_profile / admin_set_account_status / admin_set_user_role / admin_grant_wallet_credit / admin_send_notification | `PATCH /admin/users/:id/profile`, `POST /admin/users/:id/status { status, reason?, until? }`, `POST /admin/users/:id/role { role, grant }`, `POST /admin/users/:id/wallet-grant { amount, note? }`, `POST /admin/notifications/send { user_id, title, body, link?, type? }` |
| edge admin-create-user / admin-create-staff | `POST /admin/users { phone, password, name, user_type, business_name?, business_category_id?, city?, district?, address? }`, `POST /admin/staff { phone, password, name, role, bundle? }` — errors come as ApiError codes (phone_taken → 409 etc.) |
| account requests | `GET /admin/account-requests` → `[{ p: profile, categoryName }]`, `POST /admin/account-requests/:userId/decide { approve, reason? }` |
| password resets | `GET /admin/password-resets?status`, `POST /admin/password-resets/:id/decide { approve, temp_password? }` |
| stores admin | `GET /admin/stores?status` → `[{ s: store, ownerName, ownerPhone, categoryName }]`, `POST /admin/stores/:id/status { status }`, `POST /admin/stores/:id/commission { commission_pct }`, `POST /admin/stores/:id/category { business_category_id }` |
| wallets admin | `GET /admin/wallets/transactions?status&limit` → `[{ t, userName, userPhone }]`, `POST /admin/wallets/transactions/:id/respond { approve }` |
| settings | `GET /admin/settings` → `[{key,value,updatedAt}]`, `PUT /admin/settings/:key { value }` |
| broadcast | `POST /admin/notifications/broadcast { segment, title, body, link? }` → `{ recipients }` |
| admin notifications oversight | `GET /admin/notifications?search&limit` → `[{ n, userName, userPhone }]` |
| permissions | `GET /admin/permissions/catalog` → `{ defs:[{perm,grp,grpLabel,label,sort,superOnly}], bundles:[{bundle,label,sort,perms[]}] }`, `GET /admin/permissions/users/:id` → `string[]`, `POST /admin/permissions/grant { user_id, perm, grant }`, `PUT /admin/permissions/bundles/:bundle { label, perms, sort? }`, `DELETE /admin/permissions/bundles/:bundle`, `POST /admin/permissions/bundles/:bundle/apply { user_id }` |
| banners admin | `GET /admin/banners`, `POST /admin/banners { title, subtitle?, image_url?, link?, bg_color?, store_id?, is_active?, sort_order? }`, `PUT /admin/banners/:id`, `DELETE /admin/banners/:id` (field is `is_active`, fixing the old active/is_active mismatch) |
| business types admin | `GET /admin/business-categories`, `POST /admin/business-categories { name_ar, slug?, is_active?, sort_order? }`, `PUT /admin/business-categories/:id` |
| catalog admin | `POST /admin/catalog/categories`, `PUT/DELETE /admin/catalog/categories/:id?move_to`, `POST /admin/catalog/categories/reorder { ordered_ids }`, `POST /admin/catalog/items`, `PUT/DELETE /admin/catalog/items/:id`, `POST /admin/catalog/items/bulk { rows:[{id?, name, default_price, barcode, category_id, category_name, image_url, ...}] }` → `{inserted, updated, errors:[{index,error}]}`, `POST /admin/catalog/items/normalize-sort`, `POST /admin/catalog/wipe` (super), images via `POST /admin/catalog/images` (upload) |
| rpc admin_list_audit_logs / login sessions / app usage / user files | `GET /admin/audit-logs?user_id&search&role_group&action&table&from&to&limit&offset` → `{items,total}`; `GET /admin/login-sessions?user_id&status&limit&offset`; `GET /admin/app-usage?user_id&status&limit&offset` (items have `isOpen`, `durationSeconds`, `userName`); `GET /admin/user-files?user_id&search&limit&offset` (items: userId,userName,userPhone,userRole,registeredAt,totalOpens,isOpenNow,lastOpenedAt,totalLogins,activeSessions,lastLoginAt,totalActions,lastActionAt) |
| `my_permissions` in AdminShell/CreateUserDialog/RolesDialog | `useAuth().me` → `{ super, is_staff, perms }` |
| library ZIP import (`library-import.tsx`) | keep client-side ZIP parsing; upload each image with `http.upload("/admin/catalog/images", blob)` then `POST /admin/catalog/items/bulk`; categories via `POST /admin/catalog/categories`; wipe via `POST /admin/catalog/wipe` |

## Definition of done per file
`grep -n supabase <file>` empty, `pnpm exec tsc --noEmit -p tsconfig.json` shows no errors for the file, JSX renders the same information as before with the new field names.

## Added after the first pass
- `GET /products/by-barcode?barcode=&limit=` (public) → `[{ p: product, storeName, storeIsOpen, storeLat, storeLng }]` for cross-store barcode search (`CustomerScanButton`).
- `GET /me/favorites` product rows now carry `storeName`.
- Merchant/customer order lists now include `customerRated` (merchant already rated the customer) and `rated` (customer already rated the order).
- `GET /merchant/credit/accounts` rows include `pendingCount` and `lastTxAt`.
- `GET /merchant/reports/summary` includes `online_revenue` and `in_store_revenue`.
- `PATCH /merchant/offers/:id` accepts a partial body.
- `DELETE /admin/business-categories/:id` (409 `conflict` when referenced); banner `title` optional; catalog category rename/delete now propagates `category_name`/`main_section` to items; `GET /admin/user-files?status=open` filters server-side.
