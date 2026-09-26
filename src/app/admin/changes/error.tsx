"use client";

import { StaffRouteError } from "@/components/staff/route-states";

export default function RouteError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <StaffRouteError {...props} />;
}
