import { SkeletonCards } from "@/components/common/states";

export default function Loading() {
  return (
    <div className="container-page py-8">
      <div className="mb-4 h-5 w-56 animate-pulse rounded bg-muted" />
      <div className="mb-3 h-10 w-2/3 animate-pulse rounded-lg bg-muted" />
      <div className="mb-8 h-6 w-1/2 animate-pulse rounded bg-muted" />
      <SkeletonCards count={3} label="Loading provider details" />
    </div>
  );
}
