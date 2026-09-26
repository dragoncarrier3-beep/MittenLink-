"use server";

import { z } from "zod";
import { asCurrentUser, getCurrentUser } from "@/lib/auth";
import { asPublic } from "@/lib/db";
import { parseForm, runAction, zOptionalEmail, zOptionalText, zOptionalUrl, zText, UserFacingError, type ActionState } from "@/lib/server/action";
import { rateLimit } from "@/lib/server/rate-limit";

const optionalInt = (label: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0), `Choose a ${label} from the list.`);

const ResourceSchema = z.object({
  kind: z.literal("resource_suggestion"),
  name: zText("Resource name", 200),
  url: zOptionalUrl(),
  description: zText("Description", 3000),
  city: zOptionalText(120),
  countyId: optionalInt("county"),
  categoryId: optionalInt("category"),
  email: zOptionalEmail(),
});

const NeedSchema = z.object({
  kind: z.literal("unmet_need"),
  description: zText("What you were looking for", 3000),
  city: zOptionalText(120),
  countyId: optionalInt("county"),
  categoryId: optionalInt("category"),
  email: zOptionalEmail(),
});

const Schema = z.discriminatedUnion("kind", [ResourceSchema, NeedSchema]);

export async function submitSuggestionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const limited = await rateLimit("suggestion", 6, 10 * 60_000);
    if (!limited.ok) {
      return { status: "error", message: `You've sent several suggestions in a short time. Please wait ${limited.retryAfterSeconds} seconds and try again.` };
    }
    const parsed = parseForm(Schema, formData);
    if (!parsed.ok) return parsed.state;
    const d = parsed.data;

    // Validate reference ids against the database (friendly errors instead of FK failures).
    if (d.countyId || d.categoryId) {
      const [check] = await asPublic((sql) =>
        sql.query<{ county_ok: boolean; category_ok: boolean }>(
          `select ($1::int is null or exists (select 1 from public.counties where id = $1)) as county_ok,
                  ($2::int is null or exists (select 1 from public.categories where id = $2 and is_active)) as category_ok`,
          [d.countyId, d.categoryId],
        ),
      );
      if (!check?.county_ok) throw new UserFacingError("Please choose a county from the list.", { countyId: "Choose a county from the list." });
      if (!check?.category_ok) throw new UserFacingError("Please choose a category from the list.", { categoryId: "Choose a category from the list." });
    }

    const user = await getCurrentUser();
    await asCurrentUser((sql) =>
      sql.query(
        `insert into public.community_submissions (kind, name, url, description, city, county_id, category_id, submitter_user_id, submitter_email, status)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'new')`,
        [
          d.kind,
          d.kind === "resource_suggestion" ? d.name : null,
          d.kind === "resource_suggestion" ? d.url : null,
          d.description,
          d.city,
          d.countyId,
          d.categoryId,
          user?.id ?? null,
          d.email,
        ],
      ),
    );

    return {
      status: "success",
      message: d.kind === "resource_suggestion" ? "Thank you for suggesting a resource." : "Thank you for telling us what you needed.",
      data: { kind: d.kind, signedIn: !!user },
    };
  });
}
