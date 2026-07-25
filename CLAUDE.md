# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SATyping is a Marathi/Hindi/English typing-test and certification platform for GCC-TBC / MPSC / MS-CIT style exams, built around the official **ISM V6 Remington** (CDAC GIST) Devanagari keyboard layout. It is a **pnpm workspace monorepo**; only pnpm is supported (`preinstall` in `package.json` blocks npm/yarn).

## Commands

Run from the repo root:

| Command | Purpose |
|---|---|
| `pnpm install` | Install all workspace deps |
| `pnpm dev:api` | Run Express API in watch mode (`tsx watch`), port 4000 |
| `pnpm dev:web` | Run Vite frontend, port 5173 (proxies `/api/*` to the API in dev) |
| `pnpm build` | `typecheck` then build every package |
| `pnpm typecheck` | Typecheck libs (`tsc --build`) then all artifacts/scripts |
| `pnpm db:push` | Push Drizzle schema to the DB (`DATABASE_URL`) |
| `pnpm db:push-force` | Force-push schema (allows destructive changes) |

There is **no test runner and no linter** configured — "typecheck" (`tsc --noEmit`) is the correctness gate. Prettier is the only formatter.

Per-package `typecheck`/`build`/`dev` scripts exist; run one package with e.g. `pnpm --filter @workspace/api-server run typecheck`.

Copy `.env.example` → `.env` at the repo root before running anything DB- or API-related.

## Architecture

### Package graph (`artifacts/*`, `lib/*`, `scripts`)

- `artifacts/gcc-tbc` — React 19 + Vite 7 + Tailwind v4 SPA (student/teacher/admin). Routing via `wouter`, server state via `@tanstack/react-query`, UI via Radix + `class-variance-authority`. Deploys to Vercel (`vercel.json`).
- `artifacts/api-server` — Express 5 API (JWT auth, bcrypt, helmet, rate limiting, pino logging, Razorpay payments, nodemailer). Deploys to Render (`render.yaml`, service `satyping-api`). Bundled for prod via `build.mjs` (esbuild).
- `artifacts/mockup-sandbox` — internal design sandbox, **not deployed**.
- `lib/db` — Drizzle ORM schema + Postgres (Neon) client. `@workspace/db` exports the client (`.`) and schema (`./schema`).
- `lib/api-spec` — the OpenAPI **source of truth** (`openapi.yaml`) plus orval codegen config.
- `lib/api-zod` — **generated** Zod schemas (from the spec). Do not edit by hand.
- `lib/api-client-react` — **generated** React Query hooks + a hand-written `custom-fetch.ts` mutator. Do not edit generated files by hand.

### The codegen pipeline (important)

`lib/api-spec/openapi.yaml` is the single contract. Running `pnpm --filter @workspace/api-spec run codegen` (orval) regenerates **both** `lib/api-zod/src/generated` and `lib/api-client-react/src/generated`, then typechecks libs. **After changing an API endpoint, edit `openapi.yaml` and re-run codegen** — never hand-edit the `generated/` directories. The api-server validates requests with the generated Zod schemas (`@workspace/api-zod`); the frontend consumes the generated hooks (`@workspace/api-client-react`).

The frontend wires the client at startup via `configureApi()` in `src/lib/api.ts`: `VITE_API_BASE_URL` sets the base URL (empty in dev, since Vite proxies), and the bearer token is read from `localStorage.accessToken`.

### The typing engine (core domain, do not duplicate)

Two files are the single source of truth and are **shared** by both the exam engine (`typing-area.tsx`) and the Notepad (`notepad-typing-area.tsx`):

- `artifacts/gcc-tbc/src/lib/ism-remington-map.ts` — physical-key → Devanagari Unicode mapping.
- `artifacts/gcc-tbc/src/lib/typing-key-handler.ts` — key-press handling (pre-consonant ि buffering, conjuncts via virama, backspace, space, English IME composition).

Extend these files rather than writing a parallel implementation. Marathi and Hindi intentionally share one Devanagari Remington layout (matches CDAC GIST). Grading always validates the **final committed Unicode text**, never raw key presses.

### API-server structure

- `src/routes/*.ts` — one router per domain (auth, users, institutes, passages, typing, tests, results, subscriptions, curriculum, certificates, plans, offers, commissions, payments, invoices, notifications, activity, analytics), all mounted in `routes/index.ts`.
- `src/lib/roles.ts` — **single source of truth for roles**. Roles: `super_admin` (OWNER — exactly one exists, cannot be self-registered or promoted into), `institute_admin`, `teacher`, `student`. Use the exported guards (`requireOwner`, `requireInstituteAdmin`, `requireStaff`, `requireStudent`) — never re-declare role string literals. `blockOwnerRoleAssignment` is defense-in-depth against role escalation in request bodies.
- `src/lib/auth.ts` — JWT (15m access / 30d refresh) + bcrypt. `requireAuth` attaches `req.user`. `TokenPayload.instituteId` is convenience only and refreshed on login — for authorization decisions, re-verify against the DB and scope institute-admin queries to `req.user.instituteId`.
- `src/app.ts` — CORS (`CORS_ORIGIN`), helmet (CSP allowlists Razorpay), rate limiting (tight on `/api/auth`, looser elsewhere). The Razorpay webhook (`POST /api/payments/webhook`) needs the **raw request body** for HMAC verification — `express.json`'s `verify` hook stashes `req.rawBody` for that path only.

### Database

Schema lives in `lib/db/src/schema/*.ts` (one file per table), aggregated in `schema/index.ts`. Changes are applied with `pnpm db:push` (Drizzle Kit — no migration files; it diffs and pushes). A `post-merge` git hook (`scripts/post-merge.sh`) runs `pnpm install --frozen-lockfile` + `db push` after merges.

## Conventions & gotchas

- **pnpm catalog**: shared dependency versions are pinned in `pnpm-workspace.yaml` under `catalog:`. Reference them as `"catalog:"` in package.json instead of hardcoding versions. `react`/`react-dom` are pinned to exact `19.1.0` (expo requirement).
- **Supply-chain guard**: `minimumReleaseAge: 1440` in `pnpm-workspace.yaml` blocks installing npm packages less than 1 day old. Do not disable it; use `minimumReleaseAgeExclude` for rare trusted exceptions.
- Never commit generated output (`dist/`, `.tsbuildinfo`, `node_modules/`, generated codegen dirs are checked in but regenerated — treat them as build artifacts).
- Emails: if SMTP env vars are unset, emails are logged instead of sent (safe for local dev).
