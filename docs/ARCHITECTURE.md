# Architecture

MittenLink Phase I is a database-driven web application: a public disability resource directory with a moderated data pipeline behind it. This document is written for a developer who did not build the original system.

## Big picture

```
 Browser (public, community members, providers, verifiers, admins)
     │  HTML (server-rendered) + small client islands (search, map, forms)
     ▼
 Next.js 16 app (Node.js runtime)
   ├─ Pages & layouts (src/app)            — server components read data
   ├─ Server actions / route handlers      — all writes, validated with zod
   ├─ Auth adapter (local | Supabase Auth) — who is the user?
   ├─ Domain services (src/lib/domain)     — claims, verification, moderation, merge
   ├─ Adapters (src/lib/integrations)      — billing, email, maps, AI discovery, storage
   └─ DB layer (src/lib/db)                — one API over two drivers
         │  every request runs as a Postgres role: anon | authenticated (RLS), or service (after an explicit role check)
         ▼
 PostgreSQL 15+  (PostGIS · pg_trgm · unaccent · Row Level Security)
   Local: PGlite (embedded, file-backed)      Production: Supabase Postgres
```

### Why this shape

- **Ownership-first and portable.** The only hard dependency is PostgreSQL. Supabase provides managed Postgres, Auth, and Storage, but each sits behind an adapter. The app can run on any Postgres host and any Node host (Vercel, Render, Fly.io, a VM). No proprietary search, queue, or database is required.
- **One source of truth for rules.** Data integrity (foreign keys, CHECK constraints), visibility (RLS), and search logic (the SQL function `search_listings`) live in the database. A future native mobile app or public API gets the same behavior.
- **Server-first rendering** gives fast, accessible pages that work without JavaScript. Client components are used only where interaction requires them: search filters, the map, autocomplete, and forms.

## Request flow and security layers

1. **Proxy** (`src/proxy.ts`) refreshes Supabase Auth cookies when Supabase Auth is enabled. It makes no authorization decisions.
2. **Page and action guards** (`src/lib/auth/index.ts`), such as `requireAdmin()` and `assertOrganizationAccess()`, run on the server for every protected page and action.
3. **Database roles and RLS.** `withActor()` opens a transaction, runs `SET LOCAL ROLE anon|authenticated`, and sets `request.jwt.claims` so `auth.uid()` works exactly as on Supabase. Policies restrict rows. For example, providers can only *propose* changes, audit logs are append-only, and internal tables are staff-only.
4. **Service transactions.** Multi-table workflows (approving a claim, applying a verified change, billing) use the privileged connection only after step 2, and always write an audit record in the same transaction.

## Code map

| Path | Purpose |
|---|---|
| `supabase/migrations/` | Schema, functions, search, RLS (source of truth) |
| `db/local/000_supabase_compat.sql` | Creates the `auth` schema and roles for PGlite or plain Postgres |
| `src/lib/db/` | Drivers (`pglite`, `postgres`), migration runner, seed data |
| `src/lib/auth/` | Session cookie, auth provider adapter, current user, guards |
| `src/lib/domain/` | Claims, verification, provider change requests, dedupe and merge |
| `src/lib/search/` | Query parsing, location resolution, search execution, gap logging |
| `src/lib/integrations/` | `billing/` (Stripe test mode and demo), email, `maps/`, `discovery/` (AI and rules), `storage/` |
| `src/lib/server/` | `audit()`, `notify()`, analytics `track()`, rate limiting, action helpers |
| `src/components/` | UI kit (shadcn/Base UI) and shared accessible components |
| `src/app/` | Routes: public, `/account`, `/provider`, `/verify`, `/admin` |
| `tests/` | Vitest unit tests, Playwright end-to-end tests, axe accessibility tests |

## Data model in one paragraph

Every public record (organization, service, program, resource/guide, event) has one row in `listings` and one row in its own typed table sharing the same id. The `listings` row holds identity, slug, title, publication status, **verification status**, and the search document. This "class-table inheritance" keeps typed fields typed, while letting other tables reference *any* record through a real foreign key: taxonomy (`listing_categories`, `listing_populations`, `listing_languages`, `listing_disability_categories`), geography (`service_areas`, derived `listing_points`), verification, saved items, and corrections. Organizations have many `organization_locations` and many `services`; services link to specific locations through `service_locations`. See [DATABASE.md](DATABASE.md).

## Adapters (swap without touching business logic)

| Concern | Default (no accounts needed) | Production option | Selected by |
|---|---|---|---|
| Database | PGlite embedded Postgres | Supabase / any Postgres with PostGIS | `DB_DRIVER`, `DATABASE_URL` |
| Auth | Local bcrypt + signed cookie | Supabase Auth | `AUTH_PROVIDER` |
| Payments | Demo billing (no card, no charge) | Stripe **test mode** | `STRIPE_SECRET_KEY` |
| Email | Server log | Resend | `EMAIL_PROVIDER` |
| Maps | Leaflet + OpenStreetMap tiles | Mapbox, or none | `NEXT_PUBLIC_MAP_PROVIDER` |
| AI discovery | Deterministic rules | Anthropic Claude | `ANTHROPIC_API_KEY` |
| File storage | Local disk (`.data/uploads`) | Supabase Storage | `STORAGE_PROVIDER` |

Every adapter fails safely:
- A map outage leaves the list working.
- An email outage never loses saved data.
- AI failures fall back to manual review.
- Payment failures state that no payment was processed.

## Future-ready (not built in Phase I)

The architecture leaves room for later phases without a redesign:

- **Phase II community features.** `profiles` is separate from `auth.users`. New tables (groups, posts, memberships) can reference `profiles` and reuse the RLS helpers (`app.has_role`, `auth.uid()`).
- **Phase III native apps.** Business rules live in Postgres (RLS, `search_listings`), and server actions call small domain functions. A REST/GraphQL layer or Supabase's auto-generated API can serve iOS and Android with the same permissions.
- **Printed annual directory.** Structured, normalized data (counties, regions, categories, locations, hours) can be exported from SQL into a print pipeline, for example HTML to PDF by region and category.
- **Plain-language guides.** `resources` already stores structured guide content: type, audience, body, source, last verified.
- **Advertising and sponsorships.** Billing is isolated in `subscriptions`, `billing_events`, and the billing adapter; campaigns, placements, and advertiser accounts can be added as new tables. Ranking in `search_listings` ignores payment by design, so any future promoted placement must be a separately labeled slot.
- **Dedicated search engine.** See [SEARCH.md](SEARCH.md#migrating-to-a-search-service).
