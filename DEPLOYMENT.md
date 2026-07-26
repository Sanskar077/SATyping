# SATyping — Production Deployment

Free-tier architecture, no code changes required to deploy:

| Layer     | Host              | Config                        |
| --------- | ----------------- | ----------------------------- |
| Frontend  | Vercel            | `vercel.json`                 |
| Backend   | Render            | `render.yaml`                 |
| Database  | Neon PostgreSQL   | `DATABASE_URL` (external)     |

Auth is **Bearer tokens in `localStorage`**, not cookies — so there is no cross-origin
cookie/`sameSite`/`secure` configuration to get right. The only cross-origin requirement is that
Render's `CORS_ORIGIN` names the Vercel URL (below).

The two services have a chicken-and-egg dependency on each other's URLs, so deploy in this order:
**Neon → Render (with a placeholder CORS) → Vercel → then set the two real URLs and redeploy both.**

---

## 1. Database — Neon

1. Create a project at <https://neon.tech> and copy the **pooled** connection string.
2. Ensure it ends with `?sslmode=require` (Neon's default pooled string does).
3. Push the schema before the first backend deploy (there are no migration files — Drizzle diffs
   and pushes):
   ```bash
   DATABASE_URL="postgresql://…?sslmode=require" pnpm db:push
   ```
4. Provision the single owner account and seed the passages/plans:
   ```bash
   pnpm --filter @workspace/scripts run create-owner        # creates the super_admin
   pnpm --filter @workspace/scripts run fetch-passages       # builds the 100-passage corpus
   pnpm --filter @workspace/scripts run seed                 # seeds passages + plans
   ```
   Do **not** set `SEED_DEMO_ACCOUNTS=yes` in production — that creates a second super_admin with a
   published password. See `scripts/src/reset-db.ts` if you need to wipe to a single owner.

---

## 2. Backend — Render

`render.yaml` is a Blueprint: from the Render dashboard, **New → Blueprint** and point it at the
repo. It provisions one Web Service (`satyping-api`) with:

- **Build:** `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server... run build`
- **Start:** `pnpm --filter @workspace/api-server run start`
- **Health check:** `/api/health`
- Build context: the **repository root** (the whole pnpm workspace, so `@workspace/db` and
  `@workspace/api-zod` resolve — they are inlined into the esbuild bundle, so there is nothing else
  to build).

### Environment variables (Render → the service → Environment)

All are `sync: false` in the blueprint, i.e. **you set them in the dashboard**:

| Variable                  | Value / source                                                        |
| ------------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`            | Neon pooled string, incl. `?sslmode=require`                          |
| `SESSION_SECRET`          | `openssl rand -base64 48`                                             |
| `CORS_ORIGIN`             | The Vercel URL, e.g. `https://your-app.vercel.app` (**required**)     |
| `FRONTEND_URL`            | Same Vercel URL — used to build email verification/reset links        |
| `RAZORPAY_KEY_ID`         | Razorpay → API Keys (`rzp_test_*` sandbox, `rzp_live_*` real)         |
| `RAZORPAY_KEY_SECRET`     | shown once when the key is generated                                  |
| `RAZORPAY_WEBHOOK_SECRET` | from the webhook created in step 4                                    |
| `SMTP_HOST/PORT/USER/PASS`| SMTP provider (Brevo/Gmail); if unset, emails are logged not sent     |
| `EMAIL_FROM`              | a sender the SMTP provider has **verified**                           |

`NODE_ENV=production` is set by the blueprint. **`CORS_ORIGIN` is required in production** — the
server refuses to boot without it, to avoid an accidental allow-all CORS policy. On the very first
deploy (before the Vercel URL exists) set it to a placeholder like `https://example.com`, then
correct it in step 5.

**Do not set `PORT`** — Render injects it and `index.ts` reads `process.env.PORT`. Pinning a value
can conflict with the port Render routes to.

---

## 3. Frontend — Vercel

Import the repo as a Vercel project. `vercel.json` supplies build/output settings, so no dashboard
build config is needed:

- **Install:** `corepack enable && pnpm install --frozen-lockfile`
- **Build:** `pnpm --filter @workspace/web... run build`
- **Output:** `artifacts/web/dist/public`
- **SPA rewrite:** all non-asset paths → `/index.html`, so deep links (e.g. `/practice/123`) refresh
  without a 404.

### Environment variable (Vercel → Project → Settings → Environment Variables)

| Variable            | Value                                        |
| ------------------- | -------------------------------------------- |
| `VITE_API_BASE_URL` | The Render backend URL, e.g. `https://satyping-api.onrender.com` |

**This is build-time.** Vite inlines it into the bundle during the build, so it must exist **before**
the build runs, and changing it later requires a **redeploy**. Setting it only at runtime does
nothing.

---

## 4. Razorpay webhook (manual, dashboard-only)

In the Razorpay dashboard → **Settings → Webhooks → Add New Webhook**:

- **URL:** `https://<render-backend>/api/payments/webhook`
- **Events:** `payment.captured` and `order.paid`
- **Secret:** generate one, and set it as `RAZORPAY_WEBHOOK_SECRET` on Render.

The app has two redundant activation paths — this webhook, and a browser-side
`POST /api/payments/verify` that fires from the checkout callback. Either activates the
subscription; they are idempotent. The verify path is what makes local/sandbox testing work at all,
since a webhook can't reach a machine on localhost.

Test cards (test mode only): `4111 1111 1111 1111`, any future expiry, any CVV, OTP `1234`.

---

## 5. Cross-service wiring (after both URLs exist)

1. On **Render**, set `CORS_ORIGIN` and `FRONTEND_URL` to the real Vercel URL → redeploy.
2. On **Vercel**, set `VITE_API_BASE_URL` to the real Render URL → redeploy.

Both redeploys are required: Render because CORS is read at boot, Vercel because the API URL is
inlined at build.

---

## 6. Verify

```bash
curl https://<render-backend>/api/health          # → {"status":"ok"}
```

Then in the browser: sign up → verify email link (points at the Vercel URL) → log in → a deep link
like `https://<vercel-app>/practice` should refresh without 404 → run a sandbox payment and confirm
the plan activates.

Diagnostics:
```bash
pnpm --filter @workspace/api-server run check-email you@example.com   # SMTP config test
```

---

## Manual steps checklist (things code cannot do)

- [ ] Neon: create project, copy pooled `DATABASE_URL` (with `sslmode=require`)
- [ ] Run `pnpm db:push`, then `create-owner` + `fetch-passages` + `seed`
- [ ] Render: create Blueprint from `render.yaml`, set all `sync: false` env vars
- [ ] Vercel: import project, set `VITE_API_BASE_URL` (build-time!)
- [ ] Razorpay: create webhook → `/api/payments/webhook`, set `RAZORPAY_WEBHOOK_SECRET`
- [ ] SMTP provider: verify sender domain + allow the Render outbound IP (see email.ts notes)
- [ ] After both deploy: set real `CORS_ORIGIN`/`FRONTEND_URL` (Render) + `VITE_API_BASE_URL`
      (Vercel), redeploy both
