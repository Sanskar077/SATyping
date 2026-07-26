# SATyping — GCC-TBC Typing Platform

A Marathi/Hindi/English typing-test and certification platform built around
the official **ISM V6 Remington** (CDAC GIST) Devanagari keyboard layout,
used for GCC-TBC / MPSC / MS-CIT style typing examinations.

## Monorepo layout

This is a pnpm workspace monorepo:

```
.
├── artifacts/
│   ├── web/        # React + Vite frontend (student/teacher/admin web app)
│   ├── api-server/     # Express API server (Node.js)
│   └── mockup-sandbox/ # Internal design/mockup sandbox (not deployed)
├── lib/
│   ├── db/             # Drizzle ORM schema + Neon Postgres client
│   ├── api-spec/       # OpenAPI/shared API spec
│   ├── api-zod/        # Generated Zod schemas (from api-spec)
│   └── api-client-react/ # Generated React Query hooks (from api-spec)
├── scripts/            # One-off/maintenance scripts
├── render.yaml          # Render Blueprint (API + static site)
├── vercel.json          # Vercel config (frontend deployment)
└── pnpm-workspace.yaml
```

### Tech stack

- **Database:** Neon (serverless PostgreSQL) via Drizzle ORM (`lib/db`)
- **API:** Express (`artifacts/api-server`), deployable to **Render**
- **Frontend:** React 19 + Vite 7 + Tailwind v4 (`artifacts/web`), deployable to **Vercel** (or Render static)
- **Package manager:** pnpm (required — see `preinstall` guard in `package.json`)

## Getting started

```bash
# 1. Install dependencies (pnpm only)
pnpm install

# 2. Configure environment variables
cp .env.example .env
# then edit .env with your Neon connection string, session secret, etc.

# 3. Push the database schema to Neon
pnpm db:push

# 4. Start the API and the web app (in separate terminals)
pnpm dev:api
pnpm dev:web

# 5. Build everything (typecheck + build all packages)
pnpm build
```

The frontend runs at `http://localhost:5173` by default; the API at
`http://localhost:4000` (see `.env.example`).

## Key features

- **Exams / Practice / Drills** — timed typing tests graded against a
  passage, using the ISM Remington Devanagari key layout for Marathi/Hindi
  and standard input for English. Grading always validates the *final
  committed Unicode text*, never raw key presses.
- **Typing Notepad** (`/notepad`) — a free-typing scratch pad (no exam, no
  grading) that reuses the *exact same* keyboard engine as exams/practice.
  Supports English/Marathi/Hindi, live character/word/speed counters, copy,
  paste, undo/redo, clear, and local save. See
  `artifacts/web/src/pages/notepad.tsx`.
- **Curriculum, certificates, institute/admin dashboards, bulk import,
  keystroke replay & heatmaps** — see `artifacts/web/src/pages`.

### The ISM Remington keyboard engine

The single source of truth for physical-key → Devanagari Unicode mapping is
`artifacts/web/src/lib/ism-remington-map.ts`. Key-press handling
(pre-consonant ि buffering, conjuncts via virama, backspace, space, IME
composition events for English) lives in one shared module,
`artifacts/web/src/lib/typing-key-handler.ts`, used by **both** the exam
engine (`typing-area.tsx`) and the Notepad (`notepad-typing-area.tsx`) — so
there is only ever one implementation to maintain.

Marathi and Hindi intentionally share the same physical layout (this
matches the official CDAC GIST software, which uses one Devanagari
Remington layout for both languages).

## Deployment

### Neon (PostgreSQL)

1. Create a Neon project and copy the pooled connection string.
2. Set `DATABASE_URL` in your `.env` (local) and in Render's environment
   variables (production).
3. Run `pnpm db:push` (or `pnpm db:push-force` to force-apply) to sync the
   Drizzle schema in `lib/db/src/schema`.

### Render (API + optional static site)

`render.yaml` declares two services:

- `satyping-api` — Node web service running the Express API
  (`artifacts/api-server`). Set `DATABASE_URL`, `SESSION_SECRET`, and
  `CORS_ORIGIN` in the Render dashboard.
- `satyping-web` — static site build of the frontend, if you choose to host
  the frontend on Render instead of/alongside Vercel.

Deploy by connecting the repo to Render and applying the Blueprint
(`render.yaml`), or by creating the services manually with the same build
commands.

### Vercel (frontend)

`vercel.json` builds `artifacts/web` as a static SPA. Set
`VITE_API_BASE_URL` to your deployed Render API URL in the Vercel project's
environment variables, then import the repo into Vercel — no further
configuration is required.

## Scripts

| Command | Description |
|---|---|
| `pnpm install` | Install all workspace dependencies |
| `pnpm build` | Typecheck + build every package |
| `pnpm typecheck` | Typecheck all packages |
| `pnpm dev:api` | Run the API server in dev mode |
| `pnpm dev:web` | Run the frontend in dev mode |
| `pnpm db:push` | Push the Drizzle schema to the configured database |
| `pnpm db:push-force` | Force-push the schema (destructive changes allowed) |

## Contributing / repo hygiene

- Only pnpm is supported (`preinstall` blocks npm/yarn).
- Generated output (`dist/`, `.tsbuildinfo`, `node_modules/`, `.turbo/`,
  `.cache/`, `.next/`, coverage reports, etc.) is git-ignored — see
  `.gitignore`. Never commit these.
- The ISM Remington keyboard map and key-handling logic must not be
  duplicated — extend `ism-remington-map.ts` / `typing-key-handler.ts`
  instead of writing a parallel implementation.
