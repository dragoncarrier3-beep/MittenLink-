"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toggleSavedResource } from "@/lib/actions/saved";

/**
 * Save / unsave a listing. Signed-out visitors get a sign-in link that
 * returns them to the current page.
 */
export function SaveButton({
  listingId,
  title,
  initialSaved,
  signedIn,
  nextPath,
  size = "sm",
  className,
}: {
  listingId: string;
  title: string;
  initialSaved: boolean;
  signedIn: boolean;
  nextPath: string;
  size?: "sm" | "default";
  className?: string;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => setSaved(initialSaved), [initialSaved]);

  if (!signedIn) {
    return (
      <Link
        href={`/sign-in?next=${encodeURIComponent(nextPath)}`}
        className={cn(buttonVariants({ variant: "outline", size }), "min-h-11", className)}
      >
        <Bookmark aria-hidden />
        <span>
          Sign in to save<span className="sr-only"> {title}</span>
        </span>
      </Link>
    );
  }

  const onClick = () => {
    const previous = saved;
    setSaved(!previous);
    setError(false);
    startTransition(async () => {
      const res = await toggleSavedResource(listingId);
      if (res.ok) {
        setSaved(res.saved);
        setMessage(res.message);
      } else {
        setSaved(previous);
        setError(true);
        setMessage(res.message);
      }
    });
  };

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        disabled={pending}
        className={cn(buttonVariants({ variant: saved ? "secondary" : "outline", size }), "min-h-11", className)}
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : saved ? <BookmarkCheck aria-hidden /> : <Bookmark aria-hidden />}
        <span>
          {saved ? "Saved" : "Save"}
          <span className="sr-only"> {title}</span>
        </span>
      </button>
      <span role={error ? "alert" : "status"} className={cn(error ? "mt-1 text-sm font-semibold text-danger" : "sr-only")}>
        {message}
      </span>
    </span>
  );
}
