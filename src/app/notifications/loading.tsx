import { SkeletonCards } from "@/components/common/states";

export default function NotificationsLoading() {
  return (
    <div className="container-page py-8">
      <SkeletonCards count={4} label="Loading notifications" />
    </div>
  );
}
