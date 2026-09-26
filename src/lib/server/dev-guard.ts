import "server-only";

/** Development-only helpers are available ONLY in local dev with DEMO_MODE on. */
export function devToolsEnabled() {
  return process.env.NODE_ENV === "development" && process.env.DEMO_MODE !== "false";
}
