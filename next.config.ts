import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(self)" },
];

const nextConfig: NextConfig = {
  // Embedded Postgres (WASM) and its extensions must load from node_modules at runtime.
  serverExternalPackages: ["@electric-sql/pglite", "@electric-sql/pglite-postgis", "postgres", "bcryptjs"],
  poweredByHeader: false,
  // Files read at runtime from disk must ship with the serverless bundle.
  outputFileTracingIncludes: {
    "/**": [
      "./demo-db/**",
      "./supabase/migrations/**",
      "./db/local/**",
      "./node_modules/@electric-sql/pglite/dist/**",
      "./node_modules/@electric-sql/pglite-postgis/dist/**",
    ],
  },
  images: {
    remotePatterns: [],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    // Windows file locking (antivirus/indexers) can break the on-disk dev cache; opt in with TURBOPACK_FS_CACHE=true.
    turbopackFileSystemCacheForDev: process.env.TURBOPACK_FS_CACHE === "true",
    serverActions: {
      bodySizeLimit: "3mb", // logo uploads are validated to ≤ 2 MB server-side
    },
  },
};

export default nextConfig;
