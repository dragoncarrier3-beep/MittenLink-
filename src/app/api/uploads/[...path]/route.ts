import { asService } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { getStorageAdapter, isSafeStorageKey } from "@/lib/integrations/storage";

export const dynamic = "force-dynamic";

function notFound() {
  return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" } });
}

/**
 * Serves stored listing media. Approved media is public; pending or rejected
 * uploads are visible only to MittenLink staff and the organization's managers.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const key = (path ?? []).map((p) => decodeURIComponent(p)).join("/");
  if (!isSafeStorageKey(key)) return notFound();

  try {
    const [media] = await asService((sql) =>
      sql.query<{ organization_id: string; status: string }>(
        "select organization_id, status from public.organization_media where storage_path = $1 order by created_at desc limit 1",
        [key],
      ),
    );
    if (!media) return notFound();

    let isPublic = media.status === "approved";
    if (!isPublic) {
      const user = await getCurrentUser();
      const allowed = !!user && (isStaff(user) || user.organizations.some((o) => o.id === media.organization_id));
      if (!allowed) return notFound();
    }
    if (isPublic) {
      // Only publish while the organization listing itself is public.
      const [pub] = await asService((sql) =>
        sql.query<{ ok: boolean }>("select app.listing_is_public($1) as ok", [media.organization_id]),
      );
      isPublic = !!pub?.ok;
      if (!isPublic) {
        const user = await getCurrentUser();
        if (!user || !(isStaff(user) || user.organizations.some((o) => o.id === media.organization_id))) return notFound();
      }
    }

    const object = await getStorageAdapter().get(key);
    if (!object) return notFound();
    return new Response(Buffer.from(object.body), {
      status: 200,
      headers: {
        "Content-Type": object.contentType,
        "Content-Length": String(object.body.byteLength),
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
        "Content-Disposition": "inline",
        "Cache-Control": isPublic ? "public, max-age=3600" : "private, no-store",
      },
    });
  } catch (err) {
    console.error("[uploads] failed to serve media", err);
    return new Response("Unavailable", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" } });
  }
}
