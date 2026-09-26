"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { asService } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { parseForm, runAction, UserFacingError, zCheckbox, zOptionalText, zText, type ActionState } from "@/lib/server/action";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function revalidateCategories() {
  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
}

const CategorySchema = z.object({
  id: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0), "Invalid category."),
  name: zText("Name", 80),
  slug: z.string().trim().max(60, "Slug must be 60 characters or fewer.").optional(),
  description: zOptionalText(400),
  parentId: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null)),
  sortOrder: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : 100))
    .refine((v) => Number.isInteger(v) && v >= 0 && v <= 9999, "Enter a whole number between 0 and 9999."),
  isFeatured: zCheckbox(),
  isActive: zCheckbox(),
});

export async function saveCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole("admin", "super_admin");
    const parsed = parseForm(CategorySchema, formData);
    if (!parsed.ok) return parsed.state;
    const d = parsed.data;
    const slug = slugify(d.slug || d.name);
    if (!slug) throw new UserFacingError("Enter a name that includes letters or numbers.", { name: "Enter a name that includes letters or numbers." });

    const id = await asService(async (sql) => {
      const dupes = await sql.query<{ id: number; name: string; slug: string }>(
        "select id, name, slug from public.categories where (lower(name) = lower($1) or slug = $2) and ($3::int is null or id <> $3)",
        [d.name, slug, d.id],
      );
      const fieldErrors: Record<string, string> = {};
      if (dupes.some((x) => x.name.toLowerCase() === d.name.toLowerCase())) fieldErrors.name = "Another category already uses this name.";
      if (dupes.some((x) => x.slug === slug)) fieldErrors.slug = `The web address "${slug}" is already used by another category.`;
      if (Object.keys(fieldErrors).length) throw new UserFacingError("Category names and web addresses must be unique.", fieldErrors);

      if (d.parentId !== null) {
        if (d.parentId === d.id) throw new UserFacingError("A category can't be its own parent.", { parentId: "Choose a different parent category." });
        // Prevent cycles: walk up from the proposed parent.
        let cursor: number | null = d.parentId;
        for (let depth = 0; cursor !== null && depth < 20; depth++) {
          const [row]: { parent_id: number | null }[] = await sql.query<{ parent_id: number | null }>("select parent_id from public.categories where id = $1", [cursor]);
          if (!row) throw new UserFacingError("The chosen parent category no longer exists.", { parentId: "Choose a different parent category." });
          cursor = row.parent_id;
          if (cursor !== null && cursor === d.id) throw new UserFacingError("That parent would create a loop.", { parentId: "Choose a parent that is not nested under this category." });
        }
      }

      const next = { name: d.name, slug, description: d.description, parent_id: d.parentId, sort_order: d.sortOrder, is_featured: d.isFeatured, is_active: d.isActive };
      if (d.id) {
        const [prev] = await sql.query<Record<string, unknown>>(
          "select name, slug, description, parent_id, sort_order, is_featured, is_active from public.categories where id = $1 for update",
          [d.id],
        );
        if (!prev) throw new UserFacingError("This category no longer exists.");
        await sql.query(
          "update public.categories set name = $2, slug = $3, description = $4, parent_id = $5, sort_order = $6, is_featured = $7, is_active = $8 where id = $1",
          [d.id, next.name, next.slug, next.description, next.parent_id, next.sort_order, next.is_featured, next.is_active],
        );
        await audit(sql, { actorId: user.id, action: "category.updated", entityType: "category", entityId: String(d.id), entityLabel: d.name, previous: prev, next });
        return d.id;
      }
      const [row] = await sql.query<{ id: number }>(
        "insert into public.categories (name, slug, description, parent_id, sort_order, is_featured, is_active) values ($1, $2, $3, $4, $5, $6, $7) returning id",
        [next.name, next.slug, next.description, next.parent_id, next.sort_order, next.is_featured, next.is_active],
      );
      await audit(sql, { actorId: user.id, action: "category.created", entityType: "category", entityId: String(row.id), entityLabel: d.name, next });
      return row.id;
    }, user.id);

    revalidateCategories();
    if (d.id) {
      revalidatePath(`/admin/categories/${id}`);
      redirect("/admin/categories?saved=updated");
    }
    return { status: "success", message: `Category "${d.name}" created.` };
  });
}

const ToggleSchema = z.object({ id: z.coerce.number().int().positive(), active: z.enum(["true", "false"]) });

export async function setCategoryActiveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole("admin", "super_admin");
    const parsed = parseForm(ToggleSchema, formData);
    if (!parsed.ok) return parsed.state;
    const active = parsed.data.active === "true";
    const name = await asService(async (sql) => {
      const [c] = await sql.query<{ name: string; is_active: boolean }>("select name, is_active from public.categories where id = $1 for update", [parsed.data.id]);
      if (!c) throw new UserFacingError("This category no longer exists.");
      if (c.is_active === active) throw new UserFacingError(active ? "This category is already active." : "This category is already inactive.");
      await sql.query("update public.categories set is_active = $2 where id = $1", [parsed.data.id, active]);
      await audit(sql, {
        actorId: user.id, action: active ? "category.activated" : "category.deactivated", entityType: "category", entityId: String(parsed.data.id), entityLabel: c.name,
        previous: { is_active: c.is_active }, next: { is_active: active },
      });
      return c.name;
    }, user.id);
    revalidateCategories();
    return {
      status: "success",
      message: active ? `"${name}" is active again and appears in search filters.` : `"${name}" was deactivated. It no longer appears in public filters; existing records keep it.`,
    };
  });
}

const DeleteSchema = z.object({ id: z.coerce.number().int().positive() });

export async function deleteCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole("admin", "super_admin");
    const parsed = parseForm(DeleteSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { id } = parsed.data;
    const name = await asService(async (sql) => {
      const [c] = await sql.query<{ name: string; slug: string; used: number }>(
        `select c.name, c.slug,
                ((select count(*) from public.listing_categories where category_id = c.id)
                 + (select count(*) from public.categories where parent_id = c.id)
                 + (select count(*) from public.community_submissions where category_id = c.id)
                 + (select count(*) from public.source_watch_candidates where suggested_category_id = c.id)
                 + (select count(*) from public.source_watch_tasks where category_id = c.id)
                 + (select count(*) from public.resource_gap_flags where category_id = c.id))::int as used
         from public.categories c where c.id = $1 for update`,
        [id],
      );
      if (!c) throw new UserFacingError("This category no longer exists.");
      if (c.used > 0) throw new UserFacingError("This category is in use, so it can't be deleted. Deactivate it instead to hide it from the public.");
      await sql.query("delete from public.categories where id = $1", [id]);
      await audit(sql, { actorId: user.id, action: "category.deleted", entityType: "category", entityId: String(id), entityLabel: c.name, previous: { name: c.name, slug: c.slug } });
      return c.name;
    }, user.id);
    revalidateCategories();
    redirect(`/admin/categories?saved=deleted&name=${encodeURIComponent(name)}`);
  });
}

// ---------------------------------------------------------------------------
// Search synonyms
// ---------------------------------------------------------------------------
const WORD = /^[a-z0-9]+$/;

const SynonymSchema = z.object({
  originalTerm: z.string().trim().optional(),
  term: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter a search term.")
    .max(40, "Keep the term under 40 characters.")
    .refine((v) => WORD.test(v), "Use a single word with letters and numbers only (no spaces or punctuation)."),
  alternatives: z
    .string()
    .trim()
    .min(1, "Enter at least one alternative.")
    .transform((v) => [...new Set(v.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean))])
    .refine((list) => list.length > 0, "Enter at least one alternative.")
    .refine((list) => list.length <= 20, "Use 20 alternatives or fewer.")
    .refine((list) => list.every((w) => WORD.test(w)), "Each alternative must be a single word (letters and numbers only), separated by commas."),
});

export async function saveSynonymAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole("admin", "super_admin");
    const parsed = parseForm(SynonymSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { term, originalTerm } = parsed.data;
    const alternatives = parsed.data.alternatives.filter((a) => a !== term);
    if (alternatives.length === 0) throw new UserFacingError("Alternatives must be different from the term.", { alternatives: "Add at least one different word." });
    await asService(async (sql) => {
      if (originalTerm) {
        const [prev] = await sql.query<{ term: string; alternatives: string[] }>("select term, alternatives from public.search_synonyms where term = $1 for update", [originalTerm]);
        if (!prev) throw new UserFacingError("This synonym no longer exists.");
        if (term !== originalTerm) {
          const [clash] = await sql.query("select 1 from public.search_synonyms where term = $1", [term]);
          if (clash) throw new UserFacingError(`"${term}" already has synonyms. Edit that entry instead.`, { term: "This term already exists." });
        }
        await sql.query("update public.search_synonyms set term = $2, alternatives = $3 where term = $1", [originalTerm, term, alternatives]);
        await audit(sql, { actorId: user.id, action: "search_synonym.updated", entityType: "search_synonym", entityId: term, entityLabel: term, previous: prev, next: { term, alternatives } });
      } else {
        const [clash] = await sql.query("select 1 from public.search_synonyms where term = $1", [term]);
        if (clash) throw new UserFacingError(`"${term}" already has synonyms. Edit that entry instead.`, { term: "This term already exists." });
        await sql.query("insert into public.search_synonyms (term, alternatives) values ($1, $2)", [term, alternatives]);
        await audit(sql, { actorId: user.id, action: "search_synonym.created", entityType: "search_synonym", entityId: term, entityLabel: term, next: { term, alternatives } });
      }
    }, user.id);
    revalidatePath("/admin/categories");
    return { status: "success", message: `Synonyms for "${term}" saved. Searches for "${term}" now also match ${alternatives.join(", ")}.` };
  });
}

const DeleteSynonymSchema = z.object({ term: z.string().trim().min(1) });

export async function deleteSynonymAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole("admin", "super_admin");
    const parsed = parseForm(DeleteSynonymSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { term } = parsed.data;
    await asService(async (sql) => {
      const [prev] = await sql.query<{ term: string; alternatives: string[] }>("select term, alternatives from public.search_synonyms where term = $1 for update", [term]);
      if (!prev) throw new UserFacingError("This synonym no longer exists.");
      await sql.query("delete from public.search_synonyms where term = $1", [term]);
      await audit(sql, { actorId: user.id, action: "search_synonym.deleted", entityType: "search_synonym", entityId: term, entityLabel: term, previous: prev });
    }, user.id);
    revalidatePath("/admin/categories");
    redirect(`/admin/categories?saved=synonym-removed&name=${encodeURIComponent(term)}#synonyms`);
  });
}
