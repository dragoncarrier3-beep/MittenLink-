"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertSignedIn } from "@/lib/auth";
import { asService } from "@/lib/db";
import { saveClaim } from "@/lib/domain/claims";
import { parseForm, runAction, zEmail, zOptionalEmail, zOptionalText, zOptionalUrl, zPhone, zText, type ActionState } from "@/lib/server/action";
import { rateLimit } from "@/lib/server/rate-limit";
import { track } from "@/lib/server/analytics";

const RELATIONSHIPS = ["owner", "executive", "staff", "board_member", "authorized_representative"] as const;

const SubmitSchema = z.object({
  organizationId: z.string().uuid(),
  relationship: z.enum(RELATIONSHIPS, { error: "Choose your relationship to the organization." }),
  claimantName: zText("Your name", 120),
  claimantTitle: zText("Your title", 120),
  workEmail: z.string().optional().transform((v) => v ?? "").pipe(zEmail("Work email")),
  workPhone: zPhone(),
  verificationDetails: zText("How we can confirm your role", 3000),
  evidenceUrl: zOptionalUrl(),
});

// Drafts may be incomplete; only the relationship and name are needed to save.
const DraftSchema = z.object({
  organizationId: z.string().uuid(),
  relationship: z.enum(RELATIONSHIPS, { error: "Choose your relationship to the organization before saving a draft." }),
  claimantName: zText("Your name", 120),
  claimantTitle: zOptionalText(120),
  workEmail: zOptionalEmail(),
  workPhone: zPhone(),
  verificationDetails: zOptionalText(3000),
  evidenceUrl: zOptionalUrl(),
});

export async function saveClaimAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertSignedIn();
    const limited = await rateLimit("claim", 10, 10 * 60_000);
    if (!limited.ok) return { status: "error", message: `Please wait ${limited.retryAfterSeconds} seconds before trying again.` };

    const submit = formData.get("intent") !== "draft";
    const parsed = submit ? parseForm(SubmitSchema, formData) : parseForm(DraftSchema, formData);
    if (!parsed.ok) return parsed.state;
    const d = parsed.data;

    const result = await asService(
      (sql) =>
        saveClaim(sql, {
          organizationId: d.organizationId,
          userId: user.id,
          relationship: d.relationship,
          claimantName: d.claimantName,
          claimantTitle: d.claimantTitle ?? "",
          workEmail: d.workEmail ?? "",
          workPhone: d.workPhone,
          verificationDetails: d.verificationDetails ?? "",
          evidenceUrl: d.evidenceUrl,
          submit,
        }),
      user.id,
    );

    revalidatePath("/account/claims");
    revalidatePath("/", "layout");
    if (submit) {
      await track("claim_completed", { listingId: d.organizationId });
      redirect("/account/claims?submitted=1");
    }
    // Reload the claim page so the saved draft is shown exactly as stored.
    const slug = String(formData.get("slug") ?? "");
    redirect(/^[a-z0-9-]{1,120}$/.test(slug) ? `/providers/${slug}/claim?saved=1` : `/account/claims?saved=${result.claimId}`);
  });
}
