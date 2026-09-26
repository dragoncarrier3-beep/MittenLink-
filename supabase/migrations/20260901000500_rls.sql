-- =====================================================================
-- MittenLink — 0005 Grants and Row Level Security
-- ---------------------------------------------------------------------
-- Model:
--   * Every table in public has RLS enabled. No policy = no access.
--   * anon / authenticated get table privileges (as on Supabase), and
--     policies decide which rows are visible or writable.
--   * Multi-table workflows (claim approval, verification, publishing,
--     billing, merges) run server-side after an explicit role check,
--     using the privileged service connection, and are audit-logged.
-- =====================================================================

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema app to anon, authenticated, service_role;
grant execute on function public.search_listings to anon, authenticated, service_role;
-- Maintenance functions are server-only.
revoke execute on function app.refresh_listing_search(uuid), app.refresh_all_listings() from public, anon, authenticated;

-- Enable RLS everywhere.
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;

-- Column-level restrictions for self-service updates.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, job_title, phone) on public.profiles to authenticated;
revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke update, delete on public.audit_logs from anon, authenticated;
revoke insert, update, delete on public.subscriptions, public.billing_events from anon, authenticated;
revoke insert, update, delete on public.user_roles, public.roles from anon, authenticated;

-- Staff-only analytic view runs with the caller's privileges.
alter view public.resource_gap_indicators set (security_invoker = true);

-- ---------------------------------------------------------------------
-- Reference data: world-readable, admin-writable
-- ---------------------------------------------------------------------
create policy "reference read" on public.counties for select using (true);
create policy "reference read" on public.places for select using (true);
create policy "reference read" on public.populations for select using (true);
create policy "reference read" on public.disability_categories for select using (true);
create policy "reference read" on public.languages for select using (true);
create policy "reference read" on public.payment_options for select using (true);
create policy "reference read" on public.roles for select using (true);
create policy "reference read" on public.search_synonyms for select using (true);
create policy "categories read" on public.categories for select using (is_active or app.is_admin());
create policy "categories admin write" on public.categories for all using (app.is_admin()) with check (app.is_admin());
create policy "synonyms admin write" on public.search_synonyms for all using (app.is_admin()) with check (app.is_admin());
create policy "settings staff read" on public.platform_settings for select using (app.is_staff());

-- ---------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------
create policy "profiles self or staff read" on public.profiles for select
  using (id = auth.uid() or app.is_staff());
create policy "profiles self update" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy "user_roles self or admin read" on public.user_roles for select
  using (user_id = auth.uid() or app.is_admin());

-- ---------------------------------------------------------------------
-- Directory records
-- ---------------------------------------------------------------------
create policy "listings read" on public.listings for select using (
  (publication_status = 'published' and verification_status <> 'archived')
  or app.is_staff()
  or app.manages_organization(app.listing_organization(id))
);
create policy "listings admin write" on public.listings for all using (app.is_admin()) with check (app.is_admin());

create policy "organizations read" on public.organizations for select using (app.can_read_listing(id));
create policy "organizations admin write" on public.organizations for all using (app.is_admin()) with check (app.is_admin());
create policy "services read" on public.services for select using (app.can_read_listing(id));
create policy "services admin write" on public.services for all using (app.is_admin()) with check (app.is_admin());
create policy "programs read" on public.programs for select using (app.can_read_listing(id));
create policy "programs admin write" on public.programs for all using (app.is_admin()) with check (app.is_admin());
create policy "resources read" on public.resources for select using (app.can_read_listing(id));
create policy "resources admin write" on public.resources for all using (app.is_admin()) with check (app.is_admin());
create policy "events read" on public.events for select using (app.can_read_listing(id));
create policy "events admin write" on public.events for all using (app.is_admin()) with check (app.is_admin());

create policy "locations read" on public.organization_locations for select using (app.can_read_listing(organization_id));
create policy "locations admin write" on public.organization_locations for all using (app.is_admin()) with check (app.is_admin());

-- Provenance is internal: staff and the organization's own managers only.
create policy "contacts staff or manager read" on public.organization_contacts for select
  using (app.is_staff() or app.manages_organization(organization_id));
create policy "contacts admin write" on public.organization_contacts for all using (app.is_admin()) with check (app.is_admin());

create policy "media read" on public.organization_media for select using (
  (status = 'approved' and app.can_read_listing(organization_id))
  or app.is_staff() or app.manages_organization(organization_id));
create policy "media admin write" on public.organization_media for all using (app.is_admin()) with check (app.is_admin());

create policy "service_locations read" on public.service_locations for select using (app.can_read_listing(service_id));
create policy "service_locations admin write" on public.service_locations for all using (app.is_admin()) with check (app.is_admin());
create policy "service_payment read" on public.service_payment_options for select using (app.can_read_listing(service_id));
create policy "service_payment admin write" on public.service_payment_options for all using (app.is_admin()) with check (app.is_admin());

create policy "listing_categories read" on public.listing_categories for select using (app.can_read_listing(listing_id));
create policy "listing_categories admin write" on public.listing_categories for all using (app.is_admin()) with check (app.is_admin());
create policy "listing_populations read" on public.listing_populations for select using (app.can_read_listing(listing_id));
create policy "listing_populations admin write" on public.listing_populations for all using (app.is_admin()) with check (app.is_admin());
create policy "listing_disabilities read" on public.listing_disability_categories for select using (app.can_read_listing(listing_id));
create policy "listing_disabilities admin write" on public.listing_disability_categories for all using (app.is_admin()) with check (app.is_admin());
create policy "listing_languages read" on public.listing_languages for select using (app.can_read_listing(listing_id));
create policy "listing_languages admin write" on public.listing_languages for all using (app.is_admin()) with check (app.is_admin());
create policy "service_areas read" on public.service_areas for select using (app.can_read_listing(listing_id));
create policy "service_areas admin write" on public.service_areas for all using (app.is_admin()) with check (app.is_admin());
create policy "listing_points read" on public.listing_points for select using (app.can_read_listing(listing_id));

-- ---------------------------------------------------------------------
-- Provider claiming and membership
-- ---------------------------------------------------------------------
create policy "claims own or admin read" on public.provider_claims for select
  using (claimant_user_id = auth.uid() or app.is_admin());
create policy "claims own insert" on public.provider_claims for insert
  with check (claimant_user_id = auth.uid() and status in ('draft', 'submitted'));
-- Claimants may edit only drafts or claims awaiting more information, and may
-- only move them to draft/submitted. Review decisions are server-side only.
create policy "claims own update" on public.provider_claims for update
  using (claimant_user_id = auth.uid() and status in ('draft', 'more_info_required'))
  with check (claimant_user_id = auth.uid() and status in ('draft', 'submitted'));

create policy "members read" on public.provider_members for select
  using (user_id = auth.uid() or app.is_admin() or app.manages_organization(organization_id));

-- ---------------------------------------------------------------------
-- Moderated provider edits: providers can only PROPOSE changes.
-- They have no write policy on directory tables at all.
-- ---------------------------------------------------------------------
create policy "change requests read" on public.provider_change_requests for select
  using (submitted_by = auth.uid() or app.manages_organization(organization_id) or app.is_staff());
create policy "change requests provider insert" on public.provider_change_requests for insert
  with check (submitted_by = auth.uid() and app.manages_organization(organization_id) and status = 'pending_review');
create policy "change requests provider withdraw" on public.provider_change_requests for update
  using (submitted_by = auth.uid() and status in ('pending_review', 'more_info_required'))
  with check (submitted_by = auth.uid() and status in ('withdrawn', 'pending_review'));

-- ---------------------------------------------------------------------
-- Community input (anyone may submit; only staff and the submitter read)
-- ---------------------------------------------------------------------
create policy "corrections submit" on public.community_corrections for insert
  with check (status = 'new' and (submitter_user_id is null or submitter_user_id = auth.uid()));
create policy "corrections read" on public.community_corrections for select
  using (app.is_staff() or (submitter_user_id is not null and submitter_user_id = auth.uid()));

create policy "family reports submit" on public.family_experience_reports for insert
  with check (status = 'submitted' and (submitted_by is null or submitted_by = auth.uid()));
create policy "family reports read" on public.family_experience_reports for select
  using (app.is_staff() or (submitted_by is not null and submitted_by = auth.uid()));

create policy "submissions submit" on public.community_submissions for insert
  with check (status = 'new' and (submitter_user_id is null or submitter_user_id = auth.uid()));
create policy "submissions read" on public.community_submissions for select
  using (app.is_staff() or (submitter_user_id is not null and submitter_user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- Staff workspaces (verification, Source Watch, dedupe, outreach, notes)
-- ---------------------------------------------------------------------
create policy "verification tasks staff" on public.verification_tasks for select using (app.is_staff());
create policy "verification history staff" on public.verification_history for select using (app.is_staff());
create policy "verification sources staff" on public.verification_sources for select using (app.is_staff());
create policy "sw sources staff" on public.source_watch_sources for select using (app.is_staff());
create policy "sw candidates staff" on public.source_watch_candidates for select using (app.is_staff());
create policy "sw tasks staff" on public.source_watch_tasks for select using (app.is_staff());
create policy "duplicates staff" on public.duplicate_suggestions for select using (app.is_staff());
create policy "merges admin" on public.listing_merges for select using (app.is_admin());
create policy "outreach admin" on public.outreach_contacts for select using (app.is_admin());
create policy "outreach interactions admin" on public.outreach_interactions for select using (app.is_admin());
create policy "internal notes staff read" on public.internal_notes for select using (app.is_staff());
create policy "internal notes staff insert" on public.internal_notes for insert
  with check (app.is_staff() and author_id = auth.uid());
create policy "gap flags staff" on public.resource_gap_flags for select using (app.is_staff());

-- ---------------------------------------------------------------------
-- Member saved items
-- ---------------------------------------------------------------------
create policy "saved resources own" on public.saved_resources for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "saved searches own" on public.saved_searches for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Analytics (written server-side only; staff read)
-- ---------------------------------------------------------------------
create policy "search logs staff" on public.search_logs for select using (app.is_admin());
create policy "failed searches staff" on public.failed_searches for select using (app.is_staff());
create policy "analytics admin" on public.analytics_events for select using (app.is_admin());

-- ---------------------------------------------------------------------
-- Billing (read-only from the browser; never writable by users)
-- ---------------------------------------------------------------------
create policy "subscriptions read" on public.subscriptions for select
  using (app.is_admin() or app.manages_organization(organization_id));
create policy "billing events admin" on public.billing_events for select using (app.is_admin());

-- ---------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------
create policy "notifications own read" on public.notifications for select using (user_id = auth.uid());
create policy "notifications own update" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Audit log: append-only (trigger) and readable by administrators.
-- Role and platform-setting history is visible to super administrators only.
-- ---------------------------------------------------------------------
create policy "audit read" on public.audit_logs for select using (
  app.is_super_admin() or (app.is_admin() and entity_type not in ('user_role', 'platform_setting'))
);
