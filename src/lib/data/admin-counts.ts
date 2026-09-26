import "server-only";
import { asService } from "@/lib/db";

export interface QueueCounts {
  claims: number;
  verification: number;
  escalated: number;
  changes: number;
  submissions: number;
  corrections: number;
  familyReports: number;
  sourceWatch: number;
  duplicates: number;
  outreachDue: number;
  renewalsDue: number;
}

/** Counts for staff navigation badges and dashboard cards. Call only after a staff role check. */
export async function getQueueCounts(): Promise<QueueCounts> {
  try {
    const [row] = await asService((sql) =>
      sql.query<QueueCounts>(`
        select
          (select count(*)::int from provider_claims where status in ('submitted', 'under_review')) as "claims",
          (select count(*)::int from verification_tasks where status in ('open', 'in_progress', 'escalated')) as "verification",
          (select count(*)::int from verification_tasks where status = 'escalated') as "escalated",
          (select count(*)::int from provider_change_requests where status = 'pending_review') as "changes",
          (select count(*)::int from listings where publication_status = 'pending') as "submissions",
          (select count(*)::int from community_corrections where status in ('new', 'in_review')) as "corrections",
          (select count(*)::int from family_experience_reports where status in ('submitted', 'under_review')) as "familyReports",
          (select count(*)::int from source_watch_candidates where status in ('new', 'reviewing', 'possible_duplicate')) as "sourceWatch",
          (select count(*)::int from duplicate_suggestions where status = 'open') as "duplicates",
          (select count(*)::int from outreach_contacts where next_follow_up_at <= current_date and status not in ('claimed', 'declined')) as "outreachDue",
          (select count(*)::int from listings where publication_status = 'published' and verification_status = 'verified' and next_review_at <= current_date + 14) as "renewalsDue"
      `),
    );
    return row;
  } catch (err) {
    console.error("[admin-counts]", err);
    return { claims: 0, verification: 0, escalated: 0, changes: 0, submissions: 0, corrections: 0, familyReports: 0, sourceWatch: 0, duplicates: 0, outreachDue: 0, renewalsDue: 0 };
  }
}
