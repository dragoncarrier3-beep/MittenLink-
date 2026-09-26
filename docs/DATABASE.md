# Database

The database is PostgreSQL 15+ with three extensions: **PostGIS** (geography and radius queries), **pg_trgm** (typo-tolerant matching), and **unaccent**. Migrations in `supabase/migrations/` are plain SQL. They run unchanged on Supabase and on the local embedded database (PGlite).

## Migrations

| File | Contents |
|---|---|
| `20260901000100_extensions_and_reference.sql` | Extensions, `app` helper schema, profiles/roles/user_roles, counties, places (gazetteer), taxonomies, platform settings |
| `20260901000200_directory.sql` | `listings` supertype, organizations, locations, contacts (provenance), media, services, programs, resources, events, relationship tables, service areas, listing points |
| `20260901000300_workflows.sql` | Claims, members, change requests, corrections, verification tasks/history/sources, family reports, submissions, Source Watch, duplicates/merges, outreach, internal notes, saved items, search analytics, gap flags, analytics events, subscriptions, billing events, notifications, audit logs |
| `20260901000400_functions_and_search.sql` | Authorization helpers, search-document triggers, synonym table, `search_listings()`, public-safe views |
| `20260901000500_rls.sql` | Grants and Row Level Security policies for every table |

Rules for new migrations:
1. Never edit a migration that has been applied anywhere. Add a new file with a later timestamp.
2. Enable RLS and add policies for every new table. Without policies, a table is deny-by-default.
3. Grant table privileges to `anon, authenticated, service_role`. RLS then decides which rows each role sees.

How to apply migrations:
- **Local:** automatic on the first request (`src/lib/db/index.ts`), or run `npm run db:migrate`.
- **Supabase:** run `supabase link --project-ref <ref>`, then `supabase db push` (recommended). Alternatively, run `DB_DRIVER=postgres DATABASE_URL=… npm run db:migrate`.
- **Plain PostgreSQL (not Supabase):** run `DB_INCLUDE_COMPAT=true DB_DRIVER=postgres npm run db:migrate`. This first creates the `auth` schema and the `anon`/`authenticated` roles.

## Seed data

`src/lib/db/seed/` contains fictional demonstration data placed in real Michigan geography:

- `reference.ts`: all 83 Michigan counties (FIPS code, region, approximate centroid), ~120 cities with ZIP codes, categories, populations, disability categories, languages, payment options, roles, search synonyms, and platform settings.
- `organizations.ts`: 27 fictional organizations, 36 locations, 77 services.
- `content.ts`: 10 programs, 12 plain-language guides/resources, 10 events.
- `index.ts`: the loader, plus workflow data:
  - 14 demo accounts and 10 provider claims
  - 14 verification tasks, verification history with sources, change requests, and community corrections
  - 8 family reports
  - 6 watched sources, 9 Source Watch candidates, 3 duplicate suggestions
  - 11 outreach contacts
  - 15 failed-search aggregates with raw search logs, and 5 gap flags
  - subscriptions in each state (active, trialing, past due, cancelled)
  - notifications, internal notes, and audit history

All dates are relative to the moment of seeding, so the demo always looks current. Every seeded listing has `is_demo = true`. Contact details use the reserved `.example` domain and 555-01xx phone numbers.

Commands:
```bash
npm run db:reset   # local only: delete .data/pglite, migrate, seed (stop the dev server first)
npm run db:seed    # seed an empty database (local or DATABASE_URL); needs DEMO_ACCOUNT_PASSWORD
```
With `AUTH_PROVIDER=supabase`, the seed script creates demo users through the Supabase Admin API. This requires `SUPABASE_SERVICE_ROLE_KEY`.

## Build Bible table names → implementation

Most Build Bible tables map one-to-one. A few are generalized so they work for every record type with real foreign keys:

| Build Bible | Implementation | Notes |
|---|---|---|
| users | `auth.users` | Managed by Supabase Auth, or by the local compat table |
| profiles, roles, user_roles | same | |
| organizations, organization_locations, organization_contacts | same | Contacts carry provenance |
| services, service_locations | same | |
| organization_services | `services.organization_id` | Each service belongs to exactly one organization |
| programs, resources, events | same | Typed tables sharing `listings.id` |
| categories, populations, disability_categories, languages, counties | same | |
| resource_categories, resource_populations, resource_disability_categories, resource_languages | `listing_categories`, `listing_populations`, `listing_disability_categories`, `listing_languages` | "Resource" in the generic sense: these apply to all record types |
| service_areas | same | Statewide, county, or radius scope |
| provider_claims, provider_members | same | |
| verification_records | `verification_tasks` | The review queue |
| verification_history, verification_sources | same | Internal notes are staff-only |
| provider_change_requests | same | Moderated provider edits |
| family_experience_reports | same | Public view: `public_family_experiences` |
| source_watch_sources, source_watch_candidates | same, plus `source_watch_tasks` | |
| outreach_contacts, outreach_interactions | same | |
| saved_resources, saved_searches | same | |
| search_logs, failed_searches, resource_gap_flags | same, plus the `resource_gap_indicators` view | No personal identifiers stored |
| subscriptions, billing_events | same | |
| notifications, audit_logs | same | Audit log is append-only (trigger, and no update/delete grants) |

Additional supporting tables: `listings` (supertype), `listing_points` (derived map/radius points), `places` (city/ZIP gazetteer), `payment_options`, `service_payment_options`, `organization_media`, `community_corrections`, `community_submissions`, `duplicate_suggestions`, `listing_merges`, `internal_notes`, `analytics_events`, `platform_settings`, `search_synonyms`.

## Key constraints and conventions

- **Status fields** use `CHECK` constraints, which are easy to extend with a migration. Human-readable labels are in `src/lib/labels.ts`.
- **Geography** uses `geography(Point, 4326)` with GiST indexes. County boundaries are optional (`counties.boundary`). If boundaries are loaded (for example from US Census TIGER/Line, which is public domain), geographic matching automatically uses exact polygons instead of centroids.
- **Search documents** (`listings.search_vector`, `search_text`, `primary_city`, `listing_points`) are maintained by triggers that call `app.refresh_listing_search(id)`. Bulk loaders set `app.bulk_load = on` and call `app.refresh_all_listings()` once at the end.
- **`audit_logs`** cannot be updated or deleted (enforced by a trigger). The one exception: the actor is anonymized when a profile is deleted.
- **No comma-separated relational data.** Every many-to-many relationship is a join table.
