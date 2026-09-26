import type { NextRequest } from "next/server";
import { getCurrentUser, isAdmin, isSuperAdmin } from "@/lib/auth";
import { csvResponse, EXPORT_DATASETS, exportDataset, toCsv, type ExportDataset } from "@/lib/data/admin-records";

/**
 * CSV data exports (admin only). The organization owns all of this data;
 * exports let staff take a complete copy at any time.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ dataset: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return new Response("Not authorized", { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const { dataset } = await params;
  if (!(dataset in EXPORT_DATASETS)) return new Response("Unknown dataset", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  try {
    const rows = await exportDataset(dataset as ExportDataset, isSuperAdmin(user));
    return csvResponse(`mittenlink-${dataset.replace(/_/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
  } catch (err) {
    console.error(`[export:${dataset}]`, err);
    return new Response("The export could not be created right now. Please try again.", { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}
