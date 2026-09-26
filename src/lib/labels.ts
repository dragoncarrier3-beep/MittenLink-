// Human-readable labels for database enum-like values. Keep in sync with
// CHECK constraints in supabase/migrations.

export type VerificationStatus = "unverified" | "pending_review" | "verified" | "needs_update" | "unable_to_verify" | "archived";

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  unverified: "Unverified",
  pending_review: "Pending Review",
  verified: "Verified",
  needs_update: "Needs Update",
  unable_to_verify: "Unable to Verify",
  archived: "Archived",
};

export const VERIFICATION_DESCRIPTIONS: Record<VerificationStatus, string> = {
  unverified: "MittenLink has not yet reviewed this information. Please confirm details directly with the organization.",
  pending_review: "This information was recently submitted or updated and is waiting for MittenLink review.",
  verified: "MittenLink reviewed this listing information. Verification confirms listing details only — it is not a medical or professional endorsement.",
  needs_update: "Some of this information may be out of date. MittenLink has asked the organization to confirm current details.",
  unable_to_verify: "MittenLink could not confirm this information. Please contact the organization before relying on it.",
  archived: "This record is archived and no longer maintained.",
};

export const KIND_LABELS: Record<string, string> = {
  organization: "Provider",
  service: "Service",
  program: "Program",
  resource: "Resource",
  event: "Event",
};

export const KIND_PLURAL: Record<string, string> = {
  organization: "Providers",
  service: "Services",
  program: "Programs",
  resource: "Guides & Resources",
  event: "Events",
};

export const ORG_TYPE_LABELS: Record<string, string> = {
  nonprofit: "Nonprofit",
  government: "Government agency",
  private_practice: "Private practice",
  healthcare: "Health care provider",
  school: "School or education",
  community_group: "Community group",
  advocacy: "Advocacy organization",
  faith_based: "Faith-based organization",
  other: "Other",
};

export const WAITLIST_LABELS: Record<string, string> = {
  accepting: "Accepting new clients",
  short_wait: "Accepting — short wait",
  waitlist: "Waitlist",
  not_accepting: "Not accepting new clients",
};

export const CLAIM_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  more_info_required: "More Information Required",
  approved: "Approved",
  rejected: "Rejected",
};

export const CLAIM_RELATIONSHIP_LABELS: Record<string, string> = {
  owner: "Owner or founder",
  executive: "Executive director or leadership",
  staff: "Staff member",
  board_member: "Board member",
  authorized_representative: "Authorized representative",
};

export const CHANGE_STATUS_LABELS: Record<string, string> = {
  pending_review: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
  more_info_required: "More Information Required",
  withdrawn: "Withdrawn",
};

export const TASK_REASON_LABELS: Record<string, string> = {
  new_submission: "New Submission",
  due_for_review: "Due for Review",
  provider_update: "Provider Update",
  community_correction: "Community Correction",
  source_watch: "Source Watch",
  claim: "Provider Claim",
  manual: "Manual Review",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  escalated: "Escalated to Admin",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PRIORITY_LABELS: Record<string, string> = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };

export const METHOD_LABELS: Record<string, string> = {
  provider_confirmation: "Provider confirmation",
  official_website: "Official website",
  government_source: "Government source",
  phone_confirmation: "Phone confirmation",
  email_confirmation: "Email confirmation",
  manual_research: "Manual research",
  source_watch: "Source Watch",
  community_submission: "Community submission",
  other: "Other",
};

export const REPORT_STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
  needs_clarification: "Needs Clarification",
};

export const EXPERIENCE_LABELS: Record<string, string> = {
  very_positive: "Very positive",
  positive: "Positive",
  mixed: "Mixed",
  negative: "Negative",
};

export const RATING_LABELS: Record<string, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  not_applicable: "Not applicable",
};

export const CANDIDATE_STATUS_LABELS: Record<string, string> = {
  new: "New",
  reviewing: "Reviewing",
  possible_duplicate: "Possible Duplicate",
  approved_for_import: "Approved for Import",
  rejected: "Rejected",
  imported: "Imported",
};

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  government_page: "Government page",
  nonprofit_directory: "Nonprofit directory",
  provider_website: "Provider website",
  community_organization: "Community organization",
  public_program_directory: "Public program directory",
};

export const OUTREACH_STATUS_LABELS: Record<string, string> = {
  not_contacted: "Not Contacted",
  outreach_sent: "Outreach Sent",
  follow_up_needed: "Follow-Up Needed",
  responded: "Responded",
  claim_invited: "Claim Invited",
  claimed: "Claimed",
  declined: "Declined",
  unable_to_reach: "Unable to Reach",
};

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  incomplete: "Incomplete",
  trialing: "Trialing",
  active: "Active",
  past_due: "Past Due",
  cancelled: "Cancelled",
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  workshop: "Workshop",
  support_group: "Support group",
  webinar: "Webinar",
  recreation: "Recreation",
  community: "Community event",
  training: "Training",
  resource_fair: "Resource fair",
};

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  guide: "Guide",
  benefits: "Benefits guide",
  rights: "Rights information",
  toolkit: "Toolkit",
  directory: "Resource list",
  article: "Article",
  video: "Video",
};

export const ROLE_LABELS: Record<string, string> = {
  community_member: "Community Member",
  provider: "Provider User",
  verifier: "Resource Verifier",
  admin: "Administrator",
  super_admin: "Super Administrator",
};

export const CORRECTION_ISSUE_LABELS: Record<string, string> = {
  phone: "Phone number",
  email: "Email address",
  website: "Website",
  address: "Address or location",
  hours: "Hours",
  services: "Services offered",
  eligibility: "Eligibility or cost",
  closed: "Organization or location has closed",
  other: "Something else",
};

export const label = (map: Record<string, string>, key: string | null | undefined) => (key ? map[key] ?? key.replace(/_/g, " ") : "—");
