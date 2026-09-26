"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { asService, type SqlClient } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { setVerificationStatus } from "@/lib/domain/verification";
import { parseForm, runAction, UserFacingError, zCheckbox, zOptionalText, zOptionalUrl, zText, type ActionState } from "@/lib/server/action";

const idList = z
  .union([z.array(z.string()), z.string()])
  .optional()
  .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]).map(Number).filter((n) => Number.isInteger(n) && n > 0));

const GuideSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  title: zText("Title", 200),
  summary: zText("Summary", 400),
  resourceType: z.enum(["guide", "benefits", "rights", "toolkit", "directory", "article", "video"], { error: "Choose a resource type." }),
  "categories[]": idList,
  "populations[]": idList,
  url: zOptionalUrl(),
  sourceName: zOptionalText(200),
  sourceUrl: zOptionalUrl(),
  body: zOptionalText(20000),
  readingMinutes: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 120), "Enter a whole number of minutes between 1 and 120."),
  statewide: zCheckbox(),
  publish: z.enum(["published", "draft"]).optional().default("published"),
  markVerified: zCheckbox(),
});

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "guide"
  );
}

async function uniqueSlug(sql: SqlClient, base: string) {
  let slug = base;
  for (let i = 2; i < 200; i++) {
    const rows = await sql.query("select 1 from public.listings where kind = 'resource' and slug = $1", [slug]);
    if (rows.length === 0) return slug;
    slug = `${base}-${i}`;
  }
  throw new UserFacingError("Could not create a unique web address for this title. Try a more specific title.");
}

async function replaceTaxonomy(sql: SqlClient, id: string, categories: number[], populations: number[]) {
  await sql.query("delete from public.listing_categories where listing_id = $1", [id]);
  await sql.query("delete from public.listing_populations where listing_id = $1", [id]);
  for (const [i, c] of categories.entries()) {
    await sql.query("insert into public.listing_categories (listing_id, category_id, is_primary) values ($1, $2, $3) on conflict do nothing", [id, c, i === 0]);
  }
  for (const p of populations) {
    await sql.query("insert into public.listing_populations (listing_id, population_id) values ($1, $2) on conflict do nothing", [id, p]);
  }
}

async function setStatewide(sql: SqlClient, id: string, statewide: boolean) {
  const [has] = await sql.query("select 1 from public.service_areas where listing_id = $1 and scope = 'statewide'", [id]);
  if (statewide && !has) await sql.query("insert into public.service_areas (listing_id, scope) values ($1, 'statewide')", [id]);
  if (!statewide && has) await sql.query("delete from public.service_areas where listing_id = $1 and scope = 'statewide'", [id]);
}

export async function saveGuideAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole("admin", "super_admin");
    const parsed = parseForm(GuideSchema, formData);
    if (!parsed.ok) return parsed.state;
    const d = parsed.data;
    const categories = d["categories[]"];
    const populations = d["populations[]"];
    if (categories.length === 0) throw new UserFacingError("Choose at least one category.", { "categories[]": "Choose at least one category so families can find this guide." });
    if (d.resourceType !== "video" && d.resourceType !== "directory" && !d.body && !d.url) {
      throw new UserFacingError("Add the guide text or a link to the resource.", { body: "Add the guide text, or provide a link to the resource." });
    }
    const readingMinutes = d.readingMinutes ?? (d.body ? Math.max(1, Math.round(d.body.split(/\s+/).length / 200)) : null);

    const id = await asService(async (sql) => {
      const validCats = await sql.query<{ id: number }>("select id from public.categories where id = any($1::int[])", [categories]);
      const validPops = await sql.query<{ id: number }>("select id from public.populations where id = any($1::int[])", [populations]);
      const cats = categories.filter((c) => validCats.some((v) => v.id === c));
      const pops = populations.filter((p) => validPops.some((v) => v.id === p));

      if (d.id) {
        const [prev] = await sql.query<Record<string, unknown>>(
          `select l.title, l.summary, r.resource_type, r.url, r.source_name, r.source_url, r.reading_minutes, length(coalesce(r.body, '')) as body_length
           from public.listings l join public.resources r on r.id = l.id where l.id = $1 for update of l`,
          [d.id],
        );
        if (!prev) throw new UserFacingError("This guide no longer exists.");
        await sql.query("update public.listings set title = $2, summary = $3 where id = $1", [d.id, d.title, d.summary]);
        await sql.query(
          "update public.resources set resource_type = $2, url = $3, source_name = $4, source_url = $5, body = $6, reading_minutes = $7 where id = $1",
          [d.id, d.resourceType, d.url, d.sourceName, d.sourceUrl, d.body, readingMinutes],
        );
        await replaceTaxonomy(sql, d.id, cats, pops);
        await setStatewide(sql, d.id, d.statewide);
        await audit(sql, {
          actorId: user.id,
          action: "resource.edited",
          entityType: "listing",
          entityId: d.id,
          entityLabel: d.title,
          previous: prev,
          next: {
            title: d.title, summary: d.summary, resource_type: d.resourceType, url: d.url, source_name: d.sourceName, source_url: d.sourceUrl,
            reading_minutes: readingMinutes, body_length: d.body?.length ?? 0, categories: cats, populations: pops, statewide: d.statewide,
          },
        });
        if (d.markVerified) {
          await setVerificationStatus(sql, { listingId: d.id, status: "verified", actorId: user.id, method: "manual_research", internalNotes: "Verified by administrator while editing the guide." });
        }
        return d.id;
      }

      const slug = await uniqueSlug(sql, slugify(d.title));
      const [row] = await sql.query<{ id: string }>(
        `insert into public.listings (kind, slug, title, summary, publication_status, verification_status, virtual_available, created_by)
         values ('resource', $1, $2, $3, $4, 'pending_review', true, $5) returning id`,
        [slug, d.title, d.summary, d.publish, user.id],
      );
      await sql.query(
        "insert into public.resources (id, resource_type, url, source_name, source_url, body, reading_minutes) values ($1, $2, $3, $4, $5, $6, $7)",
        [row.id, d.resourceType, d.url, d.sourceName, d.sourceUrl, d.body, readingMinutes],
      );
      await replaceTaxonomy(sql, row.id, cats, pops);
      await setStatewide(sql, row.id, d.statewide);
      await audit(sql, {
        actorId: user.id,
        action: "resource.created",
        entityType: "listing",
        entityId: row.id,
        entityLabel: d.title,
        next: { slug, title: d.title, resource_type: d.resourceType, publication_status: d.publish, verification_status: "pending_review", categories: cats, statewide: d.statewide },
      });
      if (d.markVerified) {
        await setVerificationStatus(sql, { listingId: row.id, status: "verified", actorId: user.id, method: "manual_research", internalNotes: "Guide written and reviewed by an administrator." });
      }
      return row.id;
    }, user.id);

    revalidatePath("/admin/resources");
    revalidatePath(`/admin/resources/${id}`);
    revalidatePath("/guides", "layout");
    redirect(`/admin/resources/${id}?saved=${d.id ? "updated" : "created"}`);
  });
}
