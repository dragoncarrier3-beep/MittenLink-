# Security, Roles & Row Level Security

## Roles

| Role | Key | Can |
|---|---|---|
| Public visitor | *(no account)* | Search and filter; view public profiles, events, and guides; submit corrections, family experience reports, and resource suggestions |
| Registered community member | `community_member` | Everything a visitor can, plus: save resources and searches, track submitted reports and claims |
| Provider user | `provider` + a `provider_members` row | Manage claimed organizations (locations, services, programs, events, contact info) by **submitting updates for review**; view verification status; manage the Enhanced subscription; view listing analytics |
| Resource verifier | `verifier` | Work the verification queue; review records and sources; add verification notes; approve verification tasks and provider updates; escalate to admins |
| Administrator | `admin` | Manage providers, non-admin users, resources, claims, verification, reports, Source Watch, outreach, analytics, and categories; view the audit log (except role and settings history) |
| Super administrator | `super_admin` | Everything an admin can, plus: manage roles and administrators, platform settings, and the complete audit history |

Role membership is stored in `user_roles`. A provider's link to a specific organization is a `provider_members` row, granted only when an admin approves a claim or grants access directly.

**Users cannot assign themselves roles.** `user_roles` has no insert, update, or delete privileges for `anon` or `authenticated`. Role changes happen only in super-admin server actions, and editing your own roles is blocked.

## Enforcement layers

1. **Server-side guards** protect every protected page (`requireAdmin`, `requireStaff`, `requireOrganizationAccess`) and every server action (`assertRole`, `assertOrganizationAccess`).
2. **Row Level Security** is enabled on every table (`supabase/migrations/20260901000500_rls.sql`). Public requests run as `anon`; signed-in requests run as `authenticated` with `auth.uid()` set. Key policies:
   - The public can read only records with `publication_status = 'published'` that are not archived.
   - Providers have **no write policy on directory tables**. Their only write path is inserting `provider_change_requests` for organizations they manage, and withdrawing their own pending requests.
   - Claimants can create and edit only their own draft or "more information required" claims, and can move them only to draft or submitted.
   - Staff only: verification tasks, history, and sources; Source Watch; duplicates; outreach; internal notes; gap flags.
   - `subscriptions` and `billing_events` are read-only for org managers and admins. The browser can never write them: table and column privileges are revoked.
   - `notifications`: users can update only `read_at`, and only on their own rows.
   - `audit_logs`: admins can read (super admins only for role and settings entries). There are no update/delete grants, and a trigger enforces append-only.
3. **Public-safe views** (`public_verification_history`, `public_family_experiences`) expose only publishable columns. Internal notes never leave staff tables.
4. **Privileged service transactions** are used only after an explicit role check, only for multi-table workflows, and always write an audit entry in the same transaction.

## Application security measures

| Measure | Implementation |
|---|---|
| Server-side validation | zod schemas on every action, with SQL CHECK constraints as a second line |
| SQL injection | Parameterized queries only; dynamic column lists come from code whitelists |
| CSRF | Next.js Server Actions verify the `Origin` header; cookies are `SameSite=Lax`; state changes never use GET (except dev-only helpers) |
| Session cookies | `HttpOnly`, `SameSite=Lax`, `Secure` in production; 12-hour JWT signed with `SESSION_SECRET`; roles are loaded from the database on every request |
| Passwords | bcrypt locally, or Supabase Auth; unknown emails are checked against a dummy hash so response timing doesn't reveal which accounts exist |
| Rate limiting | Sign-in, sign-up, corrections, reports, suggestions, and claims (`src/lib/server/rate-limit.ts`). The store is in-memory; swap in Redis or Postgres when running more than one instance |
| Uploads | Logos only; PNG, JPEG, or WebP verified by file signature (not extension); 2 MB max; alt text required; moderated before display; served with `nosniff` |
| Safe errors | Actions return friendly messages with a reference id; details are logged server-side only |
| Security headers | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (set in `next.config.ts`) |
| Secrets | Environment variables only; `.env.example` documents them without values; live Stripe keys are refused in demo mode |
| Demo helpers | One-click demo sign-in requires `DEMO_MODE=true` and a demo-flagged account; `/api/dev/*` routes additionally require `NODE_ENV=development` |

## Privacy

- **Search analytics** store the normalized query, coarse location (county), filters, and result counts. They store **no user ids, IP addresses, or session identifiers**.
- **Family experience reports** never ask for diagnoses, and the form warns against sharing medical information, Social Security numbers, or other sensitive data. Every report is moderated. Contact emails stay private.
- **Correction and suggestion emails** are optional and visible only to staff.
