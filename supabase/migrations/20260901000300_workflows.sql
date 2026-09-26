-- =====================================================================
-- MittenLink — 0003 Workflows: claims, verification, moderation,
-- Source Watch, deduplication, outreach, community input, analytics,
-- billing, notifications, audit.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Provider claiming and membership
-- ---------------------------------------------------------------------
create table public.provider_claims (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  claimant_user_id uuid not null references public.profiles(id) on delete cascade,
  relationship text not null
    check (relationship in ('owner', 'executive', 'staff', 'board_member', 'authorized_representative')),
  claimant_name text not null,
  claimant_title text not null,
  work_email text not null,
  work_phone text,
  verification_details text not null,
  evidence_url text,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'under_review', 'more_info_required', 'approved', 'rejected')),
  -- Message visible to the claimant (e.g. what additional information is needed).
  message_to_claimant text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index provider_claims_org_idx on public.provider_claims (organization_id);
create index provider_claims_user_idx on public.provider_claims (claimant_user_id);
create index provider_claims_status_idx on public.provider_claims (status);
create trigger provider_claims_touch before update on public.provider_claims
  for each row execute function app.touch_updated_at();

create table public.provider_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'manager' check (member_role in ('owner', 'manager', 'editor')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  granted_via_claim_id uuid references public.provider_claims(id) on delete set null,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index provider_members_user_idx on public.provider_members (user_id);

-- ---------------------------------------------------------------------
-- Provider change requests (moderated edits)
-- ---------------------------------------------------------------------
create table public.provider_change_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete cascade,   -- affected listing (org, service, program, event)
  target_type text not null check (target_type in ('organization', 'location', 'service', 'program', 'event')),
  target_id uuid,                        -- null when action = 'create'
  action text not null default 'update' check (action in ('create', 'update', 'archive')),
  summary text not null,
  proposed jsonb not null,               -- { field: newValue }
  current_snapshot jsonb not null default '{}'::jsonb,
  sources jsonb not null default '[]'::jsonb, -- [{ "label": "...", "url": "..." }] offered by the provider
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'rejected', 'more_info_required', 'withdrawn')),
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  reviewer_id uuid references public.profiles(id) on delete set null,
  review_message text,                   -- visible to the provider
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index change_requests_org_idx on public.provider_change_requests (organization_id);
create index change_requests_status_idx on public.provider_change_requests (status);
create trigger change_requests_touch before update on public.provider_change_requests
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------
-- Community corrections ("Report outdated information")
-- ---------------------------------------------------------------------
create table public.community_corrections (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  issue_type text not null
    check (issue_type in ('phone', 'email', 'website', 'address', 'hours', 'services', 'eligibility', 'closed', 'other')),
  details text not null,
  submitter_user_id uuid references public.profiles(id) on delete set null,
  submitter_email text,                  -- optional; private
  status text not null default 'new' check (status in ('new', 'in_review', 'resolved', 'dismissed')),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index corrections_listing_idx on public.community_corrections (listing_id);
create index corrections_status_idx on public.community_corrections (status);

-- ---------------------------------------------------------------------
-- Verification: queue tasks, immutable history, sources checked
-- (Build Bible "verification_records" == verification_tasks)
-- ---------------------------------------------------------------------
create table public.verification_tasks (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  reason text not null
    check (reason in ('new_submission', 'due_for_review', 'provider_update', 'community_correction', 'source_watch', 'claim', 'manual')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'escalated', 'completed', 'cancelled')),
  assigned_to uuid references public.profiles(id) on delete set null,
  change_request_id uuid references public.provider_change_requests(id) on delete set null,
  correction_id uuid references public.community_corrections(id) on delete set null,
  details text,
  resolution text,
  due_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index verification_tasks_status_idx on public.verification_tasks (status, priority);
create index verification_tasks_assignee_idx on public.verification_tasks (assigned_to);
create index verification_tasks_listing_idx on public.verification_tasks (listing_id);
create trigger verification_tasks_touch before update on public.verification_tasks
  for each row execute function app.touch_updated_at();

create table public.verification_history (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  task_id uuid references public.verification_tasks(id) on delete set null,
  previous_status text,
  new_status text not null,
  action text not null default 'status_change'
    check (action in ('status_change', 'verified', 'update_requested', 'unable_to_verify', 'escalated', 'change_approved', 'change_rejected', 'note')),
  method text
    check (method in ('provider_confirmation', 'official_website', 'government_source', 'phone_confirmation', 'email_confirmation', 'manual_research')),
  verifier_id uuid references public.profiles(id) on delete set null,
  public_summary text,        -- safe for public display
  internal_notes text,        -- staff only; never exposed publicly
  created_at timestamptz not null default now()
);
create index verification_history_listing_idx on public.verification_history (listing_id, created_at desc);

create table public.verification_sources (
  id uuid primary key default gen_random_uuid(),
  history_id uuid not null references public.verification_history(id) on delete cascade,
  source_type text not null
    check (source_type in ('official_website', 'government_source', 'provider_confirmation', 'phone_confirmation', 'email_confirmation', 'manual_research', 'other')),
  url text,
  description text,
  checked_at timestamptz not null default now()
);
create index verification_sources_history_idx on public.verification_sources (history_id);

-- ---------------------------------------------------------------------
-- Family experience reports (moderated; not an open review system)
-- ---------------------------------------------------------------------
create table public.family_experience_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  submitted_by uuid references public.profiles(id) on delete set null,
  approx_service_month date,             -- first day of month; approximate only
  service_type text not null,
  experience_category text not null
    check (experience_category in ('very_positive', 'positive', 'mixed', 'negative')),
  accessibility_rating text not null check (accessibility_rating in ('excellent', 'good', 'fair', 'poor', 'not_applicable')),
  accessibility_notes text,
  communication_rating text not null check (communication_rating in ('excellent', 'good', 'fair', 'poor')),
  comments text,
  publish_anonymously boolean not null default false,  -- permission to publish (always anonymous)
  contact_email text,                    -- optional; private; for clarification only
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'approved', 'rejected', 'needs_clarification')),
  moderator_id uuid references public.profiles(id) on delete set null,
  moderation_message text,               -- visible to the submitter
  moderated_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create index family_reports_org_idx on public.family_experience_reports (organization_id);
create index family_reports_status_idx on public.family_experience_reports (status);

-- ---------------------------------------------------------------------
-- Community submissions: resource suggestions and unmet needs
-- ---------------------------------------------------------------------
create table public.community_submissions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('resource_suggestion', 'unmet_need')),
  name text,
  url text,
  description text not null,
  city text,
  county_id smallint references public.counties(id),
  category_id integer references public.categories(id),
  submitter_user_id uuid references public.profiles(id) on delete set null,
  submitter_email text,
  status text not null default 'new' check (status in ('new', 'reviewed', 'added_to_source_watch', 'dismissed')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Source Watch
-- ---------------------------------------------------------------------
create table public.source_watch_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  source_type text not null
    check (source_type in ('government_page', 'nonprofit_directory', 'provider_website', 'community_organization', 'public_program_directory')),
  coverage text not null,                -- human description, e.g. "Statewide" or "Kent County"
  county_id smallint references public.counties(id),
  is_statewide boolean not null default false,
  check_frequency_days smallint not null default 30,
  last_checked_at timestamptz,
  status text not null default 'active' check (status in ('active', 'paused', 'needs_attention')),
  -- Automated retrieval is only permitted when the source owner has authorized it.
  automated_checks_authorized boolean not null default false,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.source_watch_candidates (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.source_watch_sources(id) on delete set null,
  name text not null,
  url text,
  suggested_category_id integer references public.categories(id),
  possible_city text,
  possible_county_id smallint references public.counties(id),
  excerpt text,                          -- source text captured by a human or an authorized feed
  suggestions jsonb not null default '{}'::jsonb,   -- DiscoveryAssistant output (always requires human review)
  suggestion_engine text,                -- e.g. 'rules-demo' or 'anthropic:<model>'
  duplicate_confidence smallint check (duplicate_confidence between 0 and 100),
  duplicate_listing_id uuid references public.listings(id) on delete set null,
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'possible_duplicate', 'approved_for_import', 'rejected', 'imported')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  imported_listing_id uuid references public.listings(id) on delete set null,
  discovered_at timestamptz not null default now()
);
create index sw_candidates_status_idx on public.source_watch_candidates (status);

create table public.source_watch_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text,
  county_id smallint references public.counties(id),
  category_id integer references public.categories(id),
  gap_flag_id uuid,                      -- FK added below (resource_gap_flags)
  assigned_to uuid references public.profiles(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'cancelled')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Potential duplicates (never merged automatically)
-- ---------------------------------------------------------------------
create table public.duplicate_suggestions (
  id uuid primary key default gen_random_uuid(),
  listing_a uuid not null references public.listings(id) on delete cascade,
  listing_b uuid not null references public.listings(id) on delete cascade,
  confidence smallint not null check (confidence between 0 and 100),
  signals jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'merged', 'kept_separate', 'ignored')),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (listing_a <> listing_b),
  unique (listing_a, listing_b)
);

create table public.listing_merges (
  id uuid primary key default gen_random_uuid(),
  surviving_listing_id uuid not null references public.listings(id) on delete cascade,
  merged_listing_id uuid not null references public.listings(id) on delete cascade,
  merged_snapshot jsonb not null,
  merged_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Outreach / lightweight CRM
-- ---------------------------------------------------------------------
create table public.outreach_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_name text not null,
  contact_role text,
  email text,
  phone text,
  status text not null default 'not_contacted'
    check (status in ('not_contacted', 'outreach_sent', 'follow_up_needed', 'responded', 'claim_invited', 'claimed', 'declined', 'unable_to_reach')),
  last_contacted_at timestamptz,
  next_follow_up_at date,
  assigned_to uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index outreach_org_idx on public.outreach_contacts (organization_id);
create index outreach_followup_idx on public.outreach_contacts (next_follow_up_at);
create trigger outreach_touch before update on public.outreach_contacts
  for each row execute function app.touch_updated_at();

create table public.outreach_interactions (
  id uuid primary key default gen_random_uuid(),
  outreach_contact_id uuid not null references public.outreach_contacts(id) on delete cascade,
  channel text not null check (channel in ('email', 'phone', 'meeting', 'mail', 'other')),
  summary text not null,
  status_after text,
  created_by uuid references public.profiles(id) on delete set null,
  occurred_at timestamptz not null default now()
);
create index outreach_interactions_contact_idx on public.outreach_interactions (outreach_contact_id);

-- ---------------------------------------------------------------------
-- Internal staff notes (never public)
-- ---------------------------------------------------------------------
create table public.internal_notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,             -- 'listing' | 'claim' | 'candidate' | 'gap_flag' | 'outreach' | ...
  entity_id uuid not null,
  body text not null,
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index internal_notes_entity_idx on public.internal_notes (entity_type, entity_id);

-- ---------------------------------------------------------------------
-- Community member saved items
-- ---------------------------------------------------------------------
create table public.saved_resources (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  params jsonb not null,
  created_at timestamptz not null default now()
);
create index saved_searches_user_idx on public.saved_searches (user_id);

-- ---------------------------------------------------------------------
-- Privacy-conscious search + gap analytics (no user ids, no IPs)
-- ---------------------------------------------------------------------
create table public.search_logs (
  id bigint generated always as identity primary key,
  normalized_query text not null default '',
  location_label text,
  county_id smallint references public.counties(id),
  radius_miles smallint,
  filters jsonb not null default '{}'::jsonb,
  result_count integer not null,
  outcome text not null check (outcome in ('ok', 'low', 'zero')),
  created_at timestamptz not null default now()
);
create index search_logs_created_idx on public.search_logs (created_at desc);
create index search_logs_outcome_idx on public.search_logs (outcome);

-- Aggregated unsuccessful searches (upserted by the search service).
create table public.failed_searches (
  id uuid primary key default gen_random_uuid(),
  normalized_query text not null,
  county_id smallint references public.counties(id),
  search_count integer not null default 1,
  last_result_count integer not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed'))
);
create unique index failed_searches_key on public.failed_searches (normalized_query, coalesce(county_id, 0));

create table public.resource_gap_flags (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  indicator_type text not null check (indicator_type in ('zero_supply', 'low_supply', 'unmet_demand')),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  category_id integer references public.categories(id),
  county_id smallint references public.counties(id),
  region text,
  search_count integer not null default 0,
  resource_count integer not null default 0,
  status text not null default 'open' check (status in ('open', 'researching', 'source_watch_task', 'resolved', 'dismissed')),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger gap_flags_touch before update on public.resource_gap_flags
  for each row execute function app.touch_updated_at();

alter table public.source_watch_tasks
  add constraint source_watch_tasks_gap_fk foreign key (gap_flag_id) references public.resource_gap_flags(id) on delete set null;

create table public.analytics_events (
  id bigint generated always as identity primary key,
  event_name text not null
    check (event_name in ('search_performed', 'search_zero_results', 'filter_applied', 'filter_abandoned', 'provider_viewed', 'service_viewed', 'claim_started', 'claim_completed', 'correction_submitted', 'resource_saved', 'enhanced_upgrade_started', 'family_report_submitted')),
  listing_id uuid references public.listings(id) on delete set null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index analytics_events_name_idx on public.analytics_events (event_name, created_at desc);
create index analytics_events_listing_idx on public.analytics_events (listing_id);

-- ---------------------------------------------------------------------
-- Billing (Enhanced listings). Written only by the server billing service.
-- ---------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan text not null default 'enhanced' check (plan in ('enhanced')),
  status text not null check (status in ('incomplete', 'trialing', 'active', 'past_due', 'cancelled')),
  billing_provider text not null check (billing_provider in ('stripe', 'demo')),
  provider_customer_id text,
  provider_subscription_id text,
  price_cents integer not null,
  currency text not null default 'usd',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  livemode boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_org_idx on public.subscriptions (organization_id);
create unique index subscriptions_provider_sub_key on public.subscriptions (provider_subscription_id) where provider_subscription_id is not null;
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function app.touch_updated_at();

create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  billing_provider text not null,
  provider_event_id text,
  event_type text not null,
  summary text,
  livemode boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index billing_events_provider_event_key on public.billing_events (provider_event_id) where provider_event_id is not null;

-- ---------------------------------------------------------------------
-- In-app notifications
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, read_at, created_at desc);

-- ---------------------------------------------------------------------
-- Audit log (append-only)
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_label text,
  action text not null,
  entity_type text not null,
  entity_id text,
  entity_label text,
  previous_state jsonb,
  new_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_action_idx on public.audit_logs (action);

create or replace function app.prevent_audit_mutation() returns trigger
language plpgsql as $$
begin
  -- The only permitted change is anonymizing the actor when a profile is deleted.
  if tg_op = 'UPDATE' and new.actor_id is null and old.actor_id is not null
     and row(new.action, new.entity_type, new.entity_id, new.previous_state, new.new_state, new.created_at)
         is not distinct from row(old.action, old.entity_type, old.entity_id, old.previous_state, old.new_state, old.created_at) then
    return new;
  end if;
  raise exception 'audit_logs is append-only';
end $$;
create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function app.prevent_audit_mutation();
