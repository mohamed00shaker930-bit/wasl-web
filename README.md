# wasl-web

Web app for Wasl (وصل): Vite + React 19 SPA, TanStack Router (file-based) + TanStack Query, shadcn/ui, Tailwind v4, Arabic RTL.
Talks only to `wasl-api` under the same origin (`/api`).

## Run locally
```bash
pnpm install
cp .env.example .env          # VITE_API_BASE=/api, VITE_GOOGLE_MAPS_BROWSER_KEY=
pnpm dev                      # http://localhost:5173, /api proxied to http://127.0.0.1:3000 (VITE_DEV_API to change)
pnpm build && pnpm preview    # production build, served on :4173 with the same proxy
pnpm test                     # domain unit tests (cart, checkout, credit rules, phone)
pnpm api:types                # regenerate src/api/types.gen.ts from ../wasl-api/openapi.json
```

## Layout
- `src/api/client.ts` – fetch wrapper (access token in memory, refresh via httpOnly cookie, `ApiError` with Arabic messages); `src/api/{merchant,admin}.ts` – typed helpers.
- `src/auth/store.ts` – `/auth/me` mirror (`useAuth()`, `auth.login/logout`), `src/auth/guards.ts` – `requireAuth/requireMerchant/requireAdmin` for `beforeLoad`.
- `src/routes/*.tsx` – one file per route (flat dotted names); `src/routes/__root.tsx` bootstraps auth, lock screen, toasts.
- `src/lib/` – cart (localStorage), checkout/credit rules, offline POS (`offline-db.ts` IndexedDB + `pos-outbox.ts` replay), SSE (`events.ts`), notifications, PIN lock, PWA registration.
- `public/sw.js` – hand-written service worker (navigations network-first, assets cache-first, `/api` bypassed).
- `docs/REWRITE-GUIDE.md` – endpoint map used for the Supabase → API migration.

## Deploy
`Dockerfile` builds the SPA and serves it with Caddy (`deploy/Caddyfile`). In production Caddy in `wasl-api/deploy/Caddyfile` fronts everything: `/api/*` → API, `/files/*` → MinIO, `/*` → this image.
