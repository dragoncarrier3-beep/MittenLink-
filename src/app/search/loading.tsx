import { SkeletonCards } from "@/components/common/states";

export default function Loading() {
  return (
    <div className="container-page py-8">
      <div className="mb-6 h-10 w-72 animate-pulse rounded-lg bg-muted" />
      <div className="mb-6 h-28 animate-pulse rounded-2xl bg-muted" />
      <SkeletonCards count={4} label="Loading search results" />
    </div>
  );
}
