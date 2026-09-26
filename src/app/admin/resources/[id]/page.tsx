import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { ListingDetail } from "@/components/admin/listing-detail";
import { sp, type SearchParams } from "@/components/admin/admin-labels";

export const metadata: Metadata = { title: "Manage resource" };

const NOTICES: Record<string, string> = {
  created: "Guide created. Its verification status is shown below.",
  updated: "Guide saved. Your changes are recorded in the audit log.",
};

export default async function AdminResourceDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  await requireAdmin(`/admin/resources/${id}`);
  const saved = sp((await searchParams).saved);
  return <ListingDetail kind="resource" id={id} notice={saved ? NOTICES[saved] : undefined} />;
}
