"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { asService } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { parseForm, runAction, UserFacingError, zCheckbox, zText, type ActionState } from "@/lib/server/action";

const intIn = (label: string, min: number, max: number) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .transform(Number)
    .refine((n) => Number.isInteger(n) && n >= min && n <= max, `${label} must be a whole number from ${min} to ${max}.`);

const SettingsSchema = z.object({
  planName: zText("Plan name", 80),
  planPrice: z
    .string({ error: "Price is required." })
    .trim()
    .min(1, "Price is required.")
    .transform((v) => v.replace(/^\$/, ""))
    .refine((v) => /^\d{1,5}(\.\d{1,2})?$/.test(v), "Enter a price in dollars, like 29 or 29.00.")
    .transform((v) => Math.round(Number(v) * 100))
    .refine((c) => c >= 100 && c <= 100000, "Price must be between $1 and $1,000."),
  demoPricing: zCheckbox(),
  verificationIntervalDays: intIn("Verification interval", 30, 730),
  lowResultThreshold: intIn("Low-result threshold", 0, 20),
  familyReportsEnabled: zCheckbox(),
  defaultSearchRadius: intIn("Default search radius", 5, 150),
});

const DESCRIPTIONS: Record<string, string> = {
  enhanced_plan: "Enhanced listing plan configuration.",
  verification_interval_days: "Default number of days before a verified record is due for review.",
  low_result_threshold: "Searches returning this many results or fewer are logged as low-result searches.",
  family_reports_enabled: "Allow community members to submit family experience reports.",
  default_search_radius_miles: "Default radius used for city and ZIP searches.",
};

/** Super admins only: update platform settings (each changed key is audited). */
export async function saveSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole("super_admin");
    const parsed = parseForm(SettingsSchema, formData);
    if (!parsed.ok) return parsed.state;
    const d = parsed.data;
    const changedKeys = await asService(async (sql) => {
      const rows = await sql.query<{ key: string; value: unknown }>("select key, value from public.platform_settings for update");
      const current = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, unknown>;
      const prevPlan = (current.enhanced_plan ?? {}) as Record<string, unknown>;
      const next: Record<string, unknown> = {
        enhanced_plan: { ...prevPlan, name: d.planName, price_cents: d.planPrice, currency: (prevPlan.currency as string) ?? "usd", interval: "month", demo_pricing: d.demoPricing },
        verification_interval_days: d.verificationIntervalDays,
        low_result_threshold: d.lowResultThreshold,
        family_reports_enabled: d.familyReportsEnabled,
        default_search_radius_miles: d.defaultSearchRadius,
      };
      const changed = Object.keys(next).filter((k) => JSON.stringify(current[k] ?? null) !== JSON.stringify(next[k]));
      if (changed.length === 0) throw new UserFacingError("No changes to save — the settings are the same as before.");
      for (const key of changed) {
        await sql.query(
          `insert into public.platform_settings (key, value, description, updated_by, updated_at) values ($1, $2, $3, $4, now())
           on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`,
          [key, JSON.stringify(next[key]), DESCRIPTIONS[key] ?? null, user.id],
        );
        await audit(sql, {
          actorId: user.id,
          action: "setting.changed",
          entityType: "platform_setting",
          entityId: key,
          entityLabel: key,
          previous: current[key] ?? null,
          next: next[key],
        });
      }
      return changed;
    }, user.id);
    revalidatePath("/admin/settings");
    revalidatePath("/", "layout");
    return { status: "success", message: `Settings saved (${changedKeys.length} changed). Each change is recorded in the audit log.` };
  });
}
