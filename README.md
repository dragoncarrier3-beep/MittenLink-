# MittenLink — Michigan Disability Resource Network (Phase I demo)

A database-driven statewide disability resource platform. It covers:

- unified search with geographic and typo-tolerant matching
- provider profiles with multiple locations and services
- provider claiming and moderated provider edits
- a Resource Verifier workspace and admin review queues
- Source Watch with AI-assisted discovery, deduplication, and outreach/CRM
- family experience reports and failed-search / resource-gap analytics
- Enhanced listings (test-mode billing), audit history, and accessibility built in

> All organizations, people, and contact details are **fictional demonstration data** placed in real Michigan geography.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000 — database creates and seeds itself on first request
```
No accounts or API keys are needed. Copy `.env.example` to `.env.local` to configure integrations.

**Deploying to Vercel:** import the repository and deploy with no settings needed. The build creates a pre-seeded database snapshot that each server instance loads into memory. Demo changes are temporary and reset on redeploy. For persistent data, connect Supabase (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)).

## Demo accounts

On **Sign In**, use the one-click demo buttons:

| Person | Role |
|---|---|
| Sarah Mitchell (admin@mittenlink.demo) | Super Administrator |
| Jordan Lee (verifier@mittenlink.demo) | Resource Verifier |
| Emily Carter (provider@mittenlink.demo) | Provider — Great Lakes Independent Living Network (Enhanced) |
| Alex Morgan (community@mittenlink.demo) | Community Member |

Password sign-in uses `DEMO_ACCOUNT_PASSWORD` (default for demo builds: `MittenLink-Demo-2026!`).

## Client walkthrough (about 15 minutes)

1. **Home.** Search "Autism services" with location "Ann Arbor, MI", then pick the 25-mile radius and the **Children** filter.
2. **Results.** Point out distance, verification status, "Last reviewed", and the Enhanced label (which never boosts ranking). Switch **List / Map**.
3. **Provider profile.** Open *Great Lakes Autism & Family Center*. Show services, locations, accessibility details, Verification Information, and the **Claim This Provider** and **Report outdated information** links.
4. **Typo tolerance.** Search "ocupational therapy".
5. **Zero results.** Search "Respite care" near "Alpena". The page says there's no exact match in the area, offers statewide options, and logs the search as a gap.
6. **Claim a provider.** Sign in as **Alex**, go to **Claim a Provider**, choose an organization, and submit. The claim shows under *My claims*.
7. **Approve the claim.** Sign in as **Sarah** and open **Admin → Claims**. Approve David Reynolds' claim, or the one Alex just made. Approval grants management access.
8. **Edit as a provider.** Sign in as **Emily**, go to **Provider Dashboard → Services**, edit a service, and submit it for review.
9. **Verify the change.** Sign in as **Jordan** and open **Verification Queue**. The task shows a field-by-field diff and contact provenance. Choose **Approve & Publish**, then reload the public page to see the change.
10. **Admin tools.** As **Sarah**, show **Source Watch** (candidates labeled as suggestions that require human review, duplicate confidence, import) and **Potential Duplicates** ("Michigan Ability Center" vs "Michigan Ability Ctr." at 91%). Then show **Search Analytics** (search gaps and resource-gap indicators), **Outreach**, **Enhanced Listings**, and the **Audit Log**.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Database and seed data](docs/DATABASE.md)
- [Search and geographic search](docs/SEARCH.md)
- [Verification, claims, Source Watch, and other workflows](docs/WORKFLOWS.md)
- [Roles, RLS, and security](docs/SECURITY.md)
- [Accessibility](docs/ACCESSIBILITY.md)
- [Deployment, backups, and ownership handoff](docs/DEPLOYMENT.md)
- [Engineering conventions](docs/CONVENTIONS.md)

## Tests

```bash
npm test             # unit + database tests (search, RLS permissions, seed coverage)
npm run test:e2e     # Playwright end-to-end demo flow + axe accessibility scans
```
