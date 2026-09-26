import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create an Account" };

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "";
  return (
    <div className="container-page py-10">
      <div className="max-w-lg">
        <h1 className="text-3xl font-bold">Create a free account</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          An account lets you save resources and searches, follow up on reports you submit, and claim your organization&apos;s listing.
        </p>
        <div className="mt-6">
          <SignUpForm next={next} />
        </div>
        <p className="mt-6">
          Already have an account?{" "}
          <Link href={`/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-primary underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
