# Workflows

## Verification

**Statuses:** Unverified · Pending Review · Verified · Needs Update · Unable to Verify · Archived.

Every public record shows its status and what that status means. Verified records show "This information was reviewed by MittenLink on {date}." Verification confirms listing information only. It is never a medical or professional endorsement, and it never depends on payment.

**Queue.** `verification_tasks` are created automatically by:
- new organization submissions
- provider updates
- community corrections
- Source Watch imports
- scheduled renewals (records whose `next_review_at` is near)

Each task has a reason, priority, assignee, and due date.

**Verifier actions** (`src/lib/domain/verification.ts → resolveVerificationTask`):

| Action | Effect |
|---|---|
| Verify / Approve & Publish | Applies any attached provider change, sets status to Verified, stamps `last_verified_at`, schedules `next_review_at` (+180 days, configurable), publishes pending submissions, refreshes contact provenance |
| Request update | Sets status to Needs Update; the provider receives the message (an attached change request becomes More Information Required) |
| Mark unable to verify | Sets status to Unable to Verify and shows a public notice |
| Escalate to admin | Flags the task as Escalated and notifies admins; no public change |
| Reject change | Rejects the provider's change with a message; the record is unchanged |

Every action writes a `verification_history` entry: previous and new status, method, verifier, public summary, and **private internal notes**. It also writes one `verification_sources` row per source checked, plus an audit entry.

Methods: provider confirmation, official website, government source, phone confirmation, email confirmation, manual research.

The public sees only the status, date, method, and public summary.

## Provider claim

1. The provider finds the organization and selects **Claim This Provider**.
2. They sign in or create an account.
3. They enter:
   - their relationship to the organization (owner, leadership, staff, board member, or authorized representative)
   - their work email, name, and title
   - how MittenLink can confirm their role
4. They submit the claim, or save it as a draft. Status moves from Draft to **Submitted**.
5. Admins see it in **Admin → Claims**, with a hint about whether the email domain matches the organization's website, other claims for the same organization, and internal notes.
6. The admin marks the claim **Under Review**, **Requests More Information** (the claimant edits and resubmits), **Approves** it, or **Rejects** it.
7. Approval (`reviewClaim`):
   - creates an active `provider_members` row
   - grants the `provider` role
   - marks the organization as claimed
   - updates its outreach status
   - notifies the claimant (in-app and by email)
   - writes an audit entry

## Moderated provider edits

Providers never edit public data directly. Their dashboard forms call `submitChangeRequest()`, which:
- validates only whitelisted fields
- stores a field-level diff (current vs. proposed)
- opens a `provider_update` verification task
- notifies verifiers

The verifier reviews the diff, checks sources and provenance, then does one of three things:
- **Approve:** `applyChangeRequest` publishes the change and refreshes search.
- **Request more information.**
- **Reject.**

Providers see each request's status and the reviewer's messages under **Verification & Updates**, and can withdraw pending requests.

## Community input

- **Corrections** ("Report outdated information") create a `community_corrections` row plus a `community_correction` verification task.
- **Family experience reports** are structured and moderated: Submitted → Under Review → Approved, Rejected, or Needs Clarification. Only reports with permission to publish anonymously appear publicly (through `public_family_experiences`). The form never asks for diagnoses.
- **Suggestions and unmet needs** go to `community_submissions`. Admins can review them and convert them into Source Watch candidates.
- **New organization submissions** create a *pending*, non-public organization plus a `new_submission` task. The organization becomes public only after verification.

## Source Watch & AI-assisted discovery

MittenLink tracks watched sources: government pages, nonprofit directories, provider websites, community organizations, and program directories. For each source it records coverage, status, and whether automated checks are **authorized**.

Phase I does not scrape third-party sites. Candidates are seeded, entered manually by staff, or come from authorized partner feeds.

Candidate statuses: New → Reviewing → Possible Duplicate → Approved for Import → Imported, or Rejected.

The `DiscoveryAssistant` (`src/lib/integrations/discovery/`) suggests a category, populations, extracted contact details, a summary, and possible duplicate matches.
- Output from a real AI model is labeled **"AI Suggested — Requires Human Review"**.
- Output from the deterministic fallback is labeled as rules-based.
- AI never verifies, publishes, or overrides a decision.

Importing a candidate creates a *pending* record and a verification task.

## Deduplication

A scanner compares organizations on name similarity (trigram), website domain, phone digits, address and ZIP, and email. It produces `duplicate_suggestions` with a confidence score. For example, "Michigan Ability Center" vs. "Michigan Ability Ctr." scores 91%.

Admins then choose one of:
- **Merge:** moves locations, services, programs, events, contacts, taxonomy, saved items, and reports to the surviving record; archives the other; keeps a snapshot in `listing_merges`.
- **Keep Separate.**
- **Ignore.**

Nothing is merged automatically.

## Outreach / CRM

`outreach_contacts` track the contact person, role, email, phone, status, last contacted date, next follow-up, assigned staff member, and notes.

Statuses: Not Contacted → Outreach Sent → Follow-Up Needed → Responded → Claim Invited → Claimed. A contact can also be marked Declined or Unable to Reach.

`outreach_interactions` log each touchpoint. A follow-up queue lists contacts that are due today or overdue.

## Contact provenance

Each public phone number, email, and website has an `organization_contacts` record with: value, source type, source URL, date discovered, last verified, verified by, confidence, and status.

Verifiers and admins see provenance on task and organization pages. The public sees only the contact value.

## Failed searches & resource gaps

Zero- and low-result searches are aggregated per query and county. Admins see:
- a **Search Gaps** table (e.g., "Respite care — Alpena — 27 searches — 0 results — High")
- **resource-gap indicators** (e.g., "Wheelchair transportation — 0 resources in Alpena County")

These are operational indicators, not claims that no such service exists.

Actions: create a Source Watch task, assign research, add an internal note, resolve or dismiss.

## Enhanced listings & billing

**Free listings** include the full profile, locations, services, programs, basic accessibility information, and full verification.

**MittenLink Enhanced** (demo price $29/month, configurable in Settings) adds a logo, an expanded description, featured services, and profile analytics.

Checkout goes through the billing adapter:
- With Stripe keys configured, it uses Stripe **test mode**, and webhooks update the subscription status.
- Without keys, it uses a clearly labeled demo checkout that collects no card and processes no payment.

Subscription statuses: Active, Trialing, Past Due, Cancelled.

Listing tier and verification status are always shown as separate badges.

## Notifications & audit

In-app notifications support mark read, mark all read, and opening the related item. Each notification is created in the same transaction as the event that caused it.

Optional emails are sent after the transaction commits. If an email fails, the user sees "The update was saved, but the notification email could not be sent."

Important actions write to `audit_logs`: actor, action, entity, previous state, new state, and timestamp.
