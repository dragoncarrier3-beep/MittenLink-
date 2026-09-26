import { SkeletonCards } from "@/components/common/states";

export default function Loading() {
  return (
    <div className="container-page py-8">
      <div className="mb-6 h-10 w-64 animate-pulse rounded-lg bg-muted" />
      <SkeletonCards count={4} label="Loading" />
    </div>
  );
}
