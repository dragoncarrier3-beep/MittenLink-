import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * Local session cookie (AUTH_PROVIDER=local). An HttpOnly, SameSite=Lax,
 * Secure (in production) cookie holding a short signed JWT with the user id.
 * Roles are NOT stored in the cookie; they are loaded from the database on
 * every request so role changes take effect immediately.
 */
export const SESSION_COOKIE = "ml_session";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

function secret() {
  let value = process.env.SESSION_SECRET;
  // Demonstration deployments may run without configuration. Real launches
  // (DEMO_MODE=false) must set SESSION_SECRET.
  if ((!value || value.length < 32) && process.env.DEMO_MODE !== "false") {
    value = "mittenlink-demo-only-session-secret-not-for-production-use";
  }
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET must be set to a random string of at least 32 characters.");
  }
  return new TextEncoder().encode(value);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function readSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
