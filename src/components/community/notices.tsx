import Link from "next/link";
import { Info, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export const PRIVACY_NOTICE_TEXT =
  "Do not include private medical information, Social Security numbers, or other sensitive personal information.";

/** Prominent privacy notice shown on every community input form. */
export function PrivacyNotice({ className, id = "privacy-notice" }: { className?: string; id?: string }) {
  return (
    <div id={id} className={cn("flex items-start gap-3 rounded-lg border border-warning/40 bg-warning-soft p-4 text-foreground", className)}>
      <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
      <p>
        <strong className="font-bold">Protect your privacy.</strong> {PRIVACY_NOTICE_TEXT}
      </p>
    </div>
  );
}

/** Neutral informational callout. */
export function InfoCallout({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border border-info/30 bg-info-soft p-4 text-foreground", className)}>
      <Info className="mt-0.5 size-5 shrink-0 text-info" aria-hidden />
      <div className="flex flex-col gap-1">
        {title && <p className="font-bold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}

/** Explains that an account is needed and links to sign-in / sign-up with a return path. */
export function SignInPrompt({ next, title = "Sign in or create an account to continue", children }: { next: string; title?: string; children?: React.ReactNode }) {
  const q = `?next=${encodeURIComponent(next)}`;
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="text-xl font-bold">{title}</h2>
      {children && <div className="mt-2 text-muted-foreground">{children}</div>}
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href={`/sign-in${q}`} className={buttonVariants()}>
          Sign In
        </Link>
        <Link href={`/sign-up${q}`} className={buttonVariants({ variant: "outline" })}>
          Create a Free Account
        </Link>
      </div>
    </div>
  );
}
