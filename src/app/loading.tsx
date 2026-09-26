import { LoadingState } from "@/components/common/states";

export default function Loading() {
  return (
    <div className="container-page py-12">
      <LoadingState label="Loading…" />
    </div>
  );
}
