import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { ListingDetail } from "@/components/admin/listing-detail";

export const metadata: Metadata = { title: "Manage program" };

export default async function AdminProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin(`/admin/programs/${id}`);
  return <ListingDetail kind="program" id={id} />;
}
