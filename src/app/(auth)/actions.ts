"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { signInAsDemoUser, signInWithPassword, signOut, signUpWithPassword } from "@/lib/auth/provider";
import { parseForm, runAction, zEmail, zText, type ActionState } from "@/lib/server/action";
import { rateLimit } from "@/lib/server/rate-limit";

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  // Only allow same-site relative paths.
  return next.startsWith("/") && !next.startsWith("//") ? next : "/account";
}

const SignInSchema = z.object({
  email: zEmail(),
  password: z.string().min(1, "Password is required."),
});

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const limited = await rateLimit("sign-in", 10, 5 * 60_000);
    if (!limited.ok) {
      return { status: "error", message: `Too many sign-in attempts. Please wait ${limited.retryAfterSeconds} seconds and try again.` };
    }
    const parsed = parseForm(SignInSchema, formData);
    if (!parsed.ok) return { ...parsed.state, values: { email: String(formData.get("email") ?? "") } };
    const result = await signInWithPassword(parsed.data.email, parsed.data.password);
    if (!result.ok) {
      return {
        status: "error",
        message: result.reason === "inactive" ? "This account has been deactivated. Please contact MittenLink." : "The email or password is incorrect.",
        values: { email: parsed.data.email },
      };
    }
    redirect(safeNext(formData.get("next")));
  });
}

export async function demoSignInAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const result = await signInAsDemoUser(userId);
  if (!result.ok) redirect("/sign-in?error=demo");
  redirect(safeNext(formData.get("next")));
}

const SignUpSchema = z
  .object({
    fullName: zText("Full name", 120),
    email: zEmail(),
    password: z.string().min(10, "Use at least 10 characters for your password.").max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match.", path: ["confirm"] });

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const limited = await rateLimit("sign-up", 5, 10 * 60_000);
    if (!limited.ok) return { status: "error", message: "Too many attempts. Please try again in a few minutes." };
    const keep = { fullName: String(formData.get("fullName") ?? ""), email: String(formData.get("email") ?? "") };
    const parsed = parseForm(SignUpSchema, formData);
    if (!parsed.ok) return { ...parsed.state, values: keep };
    const result = await signUpWithPassword(parsed.data.email, parsed.data.password, parsed.data.fullName);
    if (!result.ok) {
      return {
        status: "error",
        message: result.reason === "exists" ? "An account with this email already exists. Try signing in instead." : "We couldn't create your account right now. Please try again.",
        fieldErrors: result.reason === "exists" ? { email: "This email is already registered." } : undefined,
        values: keep,
      };
    }
    redirect(safeNext(formData.get("next")));
  });
}

export async function signOutAction() {
  await signOut();
  redirect("/");
}
