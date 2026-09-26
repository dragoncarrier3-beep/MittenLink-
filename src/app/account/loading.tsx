import { SkeletonCards } from "@/components/common/states";

export default function AccountLoading() {
  return <SkeletonCards count={3} label="Loading your account" />;
}
