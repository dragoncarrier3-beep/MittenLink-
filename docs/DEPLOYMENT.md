# Deployment, Backups & Ownership Handoff

## Recommended production setup

- **Hosting:** Vercel. Any Node 20+ host also works, because the app is standard Next.js.
- **Database, Auth, and Storage:** Supabase (Postgres 15+ with PostGIS).
- **Payments:** Stripe (test mode for the demo).
- **Email:** Resend.
- **Domain:** registered in the nonprofit's own registrar account.

Create every account **under the nonprofit's own organization/email**, then invite the developer as a member. Never the reverse.

## Step by step

1. **Supabase project** (owned by the nonprofit):
   - Enable the extensions `postgis`, `pg_trgm`, and `unaccent` in the Database → Extensions page (the migrations also try to create them).
   - `supabase link --project-ref <ref>`
   - `supabase db push` (applies `supabase/migrations/*`).
   - Auth → Email: enable email/password. Set the site URL to the production domain.
   - Storage: create a bucket named `listing-media` (public read, or signed URLs).
2. **Seed** (optional, demo only). Run with the production environment variables:
   `DB_DRIVER=postgres AUTH_PROVIDER=supabase DEMO_ACCOUNT_PASSWORD=… npm run db:seed`
   For a real launch, skip the demo seed and load reference data only. The reference lists live in `src/lib/db/seed/reference.ts`.
3. **Vercel project** (owned by the nonprofit): import the GitHub repository and set these environment variables (see `.env.example`):
   - `DB_DRIVER=postgres`
   - `DATABASE_URL` (Supabase transaction pooler, port 6543)
   - `AUTH_PROVIDER=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `STORAGE_PROVIDER=supabase`
   - `NEXT_PUBLIC_SITE_URL`
   - Optional integrations: `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`, `STRIPE_SECRET_KEY` (test), `STRIPE_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_MAP_PROVIDER`
   - `DEMO_MODE=false` for a real launch
4. **Stripe webhook:** add an endpoint at `https://<domain>/api/webhooks/stripe` for the events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, and `invoice.payment_failed`. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
5. **Domain:** add it in Vercel, then point DNS records from the nonprofit's registrar.
6. **Smoke test:** check that `/api/health` returns `{ ok: true }`, then run the demo script in the README.

The local embedded database (PGlite) is for development and self-contained demos only. It stores data on local disk and must not be used on serverless hosts.

## Local development

```bash
cp .env.example .env.local   # set SESSION_SECRET and DEMO_ACCOUNT_PASSWORD
npm install
npm run dev                  # http://localhost:3000; the database auto-creates and seeds on first request
```
`npm run dev` uses webpack. Turbopack's on-disk dev cache can hit Windows file locks; if it works on your machine, you can opt in with `TURBOPACK_FS_CACHE=true` and `next dev`.

## Backups & export

| What | How |
|---|---|
| **Automated database backups** | Supabase daily backups (Pro plan) and optional Point-in-Time Recovery. Enable both in the nonprofit's Supabase organization. |
| **Independent database export** | `pg_dump "$DATABASE_URL" --format=custom --no-owner --file=mittenlink-$(date +%F).dump` from a scheduled job (e.g. a GitHub Action writing to nonprofit-owned cloud storage). Restore with `pg_restore --no-owner -d "$TARGET_URL" file.dump`. |
| **Admin CSV exports** | Admin → Settings → Data export: organizations with locations, services, programs, resources, events, verification history, audit log. |
| **Uploaded assets** | `supabase storage cp -r ss:///listing-media ./listing-media-backup` (or the S3-compatible API). Locally, files live in `.data/uploads`. |
| **Configuration** | All configuration is environment variables. Keep a copy of the production values in the nonprofit's password manager. Platform settings (plans, intervals) are in the `platform_settings` table and included in database dumps. |
| **Code** | GitHub repository owned by the nonprofit's GitHub organization. |

## Ownership handoff checklist

- [ ] GitHub organization and repository owned by the nonprofit; developer is a collaborator
- [ ] Supabase organization owned by the nonprofit; billing on the nonprofit's card
- [ ] Vercel team owned by the nonprofit
- [ ] Domain registrar and DNS owned by the nonprofit
- [ ] Stripe account owned by the nonprofit (developer has restricted/test access only)
- [ ] Resend (or other email) account and verified sending domain owned by the nonprofit
- [ ] Anthropic (optional AI) account owned by the nonprofit
- [ ] Analytics account(s) owned by the nonprofit (Phase I stores operational analytics in its own database)
- [ ] Design assets (logo SVG in `src/components/layout/logo.tsx`, colors in `src/app/globals.css`) in the repository
- [ ] All secrets rotated after handoff; stored in the nonprofit's password manager
- [ ] At least two nonprofit staff hold Super Administrator accounts
- [ ] Backup job verified with a test restore
- [ ] This documentation reviewed with the nonprofit's technical contact

No part of the system requires the original developer's accounts. Every third-party service is optional or replaceable behind an adapter.
