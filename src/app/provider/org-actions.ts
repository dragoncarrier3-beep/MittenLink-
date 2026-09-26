"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { assertSignedIn } from "@/lib/auth";
import { ACTIVE_ORG_COOKIE } from "@/lib/provider/active-org";

export async function setActiveOrganizationAction(formData: FormData) {
  const user = await assertSignedIn();
  const id = String(formData.get("organizationId") ?? "");
  if (user.organizations.some((o) => o.id === id)) {
    const store = await cookies();
    store.set(ACTIVE_ORG_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 90 });
  }
  redirect("/provider");
}
