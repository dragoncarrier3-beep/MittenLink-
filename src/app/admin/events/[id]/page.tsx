import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { ListingDetail } from "@/components/admin/listing-detail";

export const metadata: Metadata = { title: "Manage event" };

export default async function AdminEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin(`/admin/events/${id}`);
  return <ListingDetail kind="event" id={id} />;
}
