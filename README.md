# Recovery CRM — Frontend

Next.js (App Router) console for the Phase 1 debt-recovery CRM. It is a thin,
typed client over the FastAPI backend: no mock or demo data exists in any runtime
path.

## Pages

| Route | Purpose | Endpoints |
| --- | --- | --- |
| `/login` | Sign in | `POST /api/v1/auth/login` |
| `/` | Dashboard with real portfolio totals | `GET /api/v1/dashboard/summary` |
| `/customers` | Customer list: search, status filter, pagination, create | `GET/POST /api/v1/customers` |
| `/customers/[id]` | Customer detail, edit, delete, accounts | `GET/PATCH/DELETE /api/v1/customers/{id}`, `GET /api/v1/accounts?customer_id=` |
| `/accounts` | Account list: search, status/creditor/due-date filters, pagination, create | `GET/POST /api/v1/accounts` |
| `/accounts/[id]` | Account detail, edit, payment history, record payment | `GET/PATCH /api/v1/accounts/{id}`, `POST /api/v1/accounts/{id}/payments` |
| `/creditors` | Creditor list, search, pagination, create, detail | `GET/POST /api/v1/creditors` |
| `/imports` | Import history and file upload | `GET /api/v1/imports`, `POST /api/v1/imports/upload` |
| `/imports/[id]` | Map columns → validate → confirm | `GET /api/v1/imports/{id}`, `POST .../validate`, `POST .../confirm` |
| `/campaigns` | Campaign list, status filter, create | `GET/POST /api/v1/campaigns` |
| `/campaigns/[id]` | Campaign detail, edit, leads, add leads | `GET/PATCH /api/v1/campaigns/{id}`, `GET/POST .../leads` |
| `/profile` | Own name/email | `GET/PATCH /api/v1/profile` |

## Architecture notes

- **`src/lib/api.ts`** — the only place that calls `fetch`. It builds query
  strings, attaches the bearer token, unwraps the backend's `{ data: ... }`
  envelope and converts `{ error: { code, message } }` into a typed `ApiError`
  with a user-safe message. Never render `error.message` from a raw exception.
- **`src/lib/types.ts`** — mirrors the Pydantic schemas exactly. Money is typed as
  `string` because the API sends exact decimal strings; do not pass them through
  `Number`.
- **`src/lib/format.ts`** — `formatMoney` and `sumMoney` work on the decimal
  digits directly (BigInt cents), so no floating-point drift is ever displayed.
- **`src/lib/auth.tsx`** — client session state. Route guards are UX only; the
  backend authorises every request.
- **`src/hooks/use-api.ts`** — data fetching with loading/error/refresh and no
  empty flash on refetch.
- Dialogs are mounted only while open so their form state initialises from props,
  which satisfies the React hooks lint rules in this project (no `setState`
  inside effects).

## Commands

```bash
npm run dev        # development server
npm run lint       # eslint (must be clean)
npm run typecheck  # tsc --noEmit
npm run test       # vitest unit tests
npm run build      # production build
npm run start      # serve the production build
```

## Environment

```bash
cp .env.example .env.local
```

Only `NEXT_PUBLIC_API_BASE_URL` is needed. Anything containing `SECRET`,
`PASSWORD`, `TOKEN`, `DATABASE` or `PRIVATE_KEY` must never be exposed through a
`NEXT_PUBLIC_*` variable.
