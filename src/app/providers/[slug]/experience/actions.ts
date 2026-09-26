"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { asCurrentUser, getCurrentUser } from "@/lib/auth";
import { asPublic, asService } from "@/lib/db";
import { parseForm, runAction, zCheckbox, zOptionalEmail, zOptionalText, zText, UserFacingError, type ActionState } from "@/lib/server/action";
import { rateLimit } from "@/lib/server/rate-limit";
import { audit } from "@/lib/server/audit";
import { notify, notifyRole } from "@/lib/server/notifications";
import { track } from "@/lib/server/analytics";

const optionalId = () =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^[0-9a-f-]{36}$/i.test(v), "Choose a service from the list.");

const ReportSchema = z
  .object({
    organizationId: z.string().uuid(),
    serviceId: optionalId(),
    month: z.string().optional().transform((v) => (v ? Number(v) : null)),
    year: z.string().optional().transform((v) => (v ? Number(v) : null)),
    serviceType: zText("Type of service", 200),
    experience: z.enum(["very_positive", "positive", "mixed", "negative"], { error: "Choose how your overall experience was." }),
    accessibilityRating: z.enum(["excellent", "good", "fair", "poor", "not_applicable"], { error: "Choose an accessibility rating." }),
    accessibilityNotes: zOptionalText(1500),
    communicationRating: z.enum(["excellent", "good", "fair", "poor"], { error: "Choose a communication rating." }),
    comments: zOptionalText(3000),
    publish: zCheckbox(),
    email: zOptionalEmail(),
  })
  .superRefine((v, ctx) => {
    if ((v.month === null) !== (v.year === null)) {
      ctx.addIssue({ code: "custom", path: [v.month === null ? "month" : "year"], message: "Choose both a month and a year, or leave both blank." });
      return;
    }
    if (v.month !== null && v.year !== null) {
      const now = new Date();
      if (!(v.month >= 1 && v.month <= 12) || !(v.year >= 2000 && v.year <= now.getFullYear())) {
        ctx.addIssue({ code: "custom", path: ["month"], message: "Choose a valid month and year." });
      } else if (v.year === now.getFullYear() && v.month > now.getMonth() + 1) {
        ctx.addIssue({ code: "custom", path: ["month"], message: "The service date can't be in the future." });
      }
    }
  });

export async function submitFamilyReportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const limited = await rateLimit("family-report", 4, 15 * 60_000);
    if (!limited.ok) {
      return { status: "error", message: `You've sent several reports in a short time. Please wait ${limited.retryAfterSeconds} seconds and try again.` };
    }
    const parsed = parseForm(ReportSchema, formData);
    if (!parsed.ok) return parsed.state;
    const d = parsed.data;

    const [org] = await asPublic((sql) =>
      sql.query<{ id: string; title: string }>(
        "select l.id, l.title from public.listings l join public.organizations o on o.id = l.id where l.id = $1 and l.publication_status = 'published'",
        [d.organizationId],
      ),
    );
    if (!org) throw new UserFacingError("This provider is no longer available on MittenLink.");
    if (d.serviceId) {
      const [svc] = await asPublic((sql) =>
        sql.query("select 1 from public.services s join public.listings l on l.id = s.id where s.id = $1 and s.organization_id = $2 and l.publication_status = 'published'", [
          d.serviceId,
          org.id,
        ]),
      );
      if (!svc) throw new UserFacingError("Please choose a service from the list.", { serviceId: "Choose a service offered by this provider." });
    }

    const user = await getCurrentUser();
    const reportId = randomUUID();
    const serviceMonth = d.month && d.year ? `${d.year}-${String(d.month).padStart(2, "0")}-01` : null;
    // Insert as the visitor so the "family reports submit" RLS policy applies.
    await asCurrentUser((sql) =>
      sql.query(
        `insert into public.family_experience_reports
           (id, organization_id, service_id, submitted_by, approx_service_month, service_type, experience_category, accessibility_rating,
            accessibility_notes, communication_rating, comments, publish_anonymously, contact_email, status)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'submitted')`,
        [reportId, org.id, d.serviceId, user?.id ?? null, serviceMonth, d.serviceType, d.experience, d.accessibilityRating, d.accessibilityNotes, d.communicationRating, d.comments, d.publish, d.email],
      ),
    );

    try {
      await asService(async (sql) => {
        await audit(sql, {
          actorId: user?.id ?? null,
          actorLabel: user ? null : "Community member (anonymous)",
          action: "family_report.submitted",
          entityType: "family_experience_report",
          entityId: reportId,
          entityLabel: org.title,
          next: { status: "submitted", experience_category: d.experience, publish_anonymously: d.publish },
        });
        await notifyRole(sql, ["admin", "super_admin"], {
          kind: "family_report_submitted",
          title: `New family experience report: ${org.title}`,
          body: "A family experience report is waiting for moderation.",
          link: "/admin/reports",
        });
        if (user) {
          await notify(sql, {
            userId: user.id,
            kind: "family_report_submitted",
            title: "Your family experience report was received.",
            body: `Thank you for sharing your experience with ${org.title}. A moderator will review it.`,
            link: "/account/reports",
          });
        }
      }, user?.id ?? null);
    } catch (err) {
      console.error("[experience] report saved but follow-up failed", err);
    }

    await track("family_report_submitted", { listingId: org.id, properties: { experience: d.experience, publish: d.publish } });
    return { status: "success", message: "Thank you for sharing your experience.", data: { publish: d.publish, signedIn: !!user } };
  });
}
