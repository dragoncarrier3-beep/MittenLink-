import { SkeletonCards } from "@/components/common/states";

export default function ProviderLoading() {
  return <SkeletonCards count={3} label="Loading your provider dashboard" />;
}
