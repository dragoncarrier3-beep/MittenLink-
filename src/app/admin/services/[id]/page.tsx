import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { ListingDetail } from "@/components/admin/listing-detail";

export const metadata: Metadata = { title: "Manage service" };

export default async function AdminServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin(`/admin/services/${id}`);
  return <ListingDetail kind="service" id={id} />;
}
