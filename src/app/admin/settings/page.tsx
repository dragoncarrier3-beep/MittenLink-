import type { Metadata } from "next";
import { Database, Download, PlugZap } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { authProviderName } from "@/lib/auth/provider";
import { driverName } from "@/lib/db";
import { PageHeader, Panel, Section } from "@/components/common/page";
import { StatusPill } from "@/components/common/badges";
import { SettingsForm } from "@/components/admin/settings-form";
import { EXPORT_DATASETS, getPlatformSettings } from "@/lib/data/admin-records";
import { getBillingAdapter } from "@/lib/integrations/billing";
import { getEmailAdapter } from "@/lib/integrations/email";
import { formatDateTime } from "@/lib/format";
import { saveSettingsAction } from "./actions";

export const metadata: Metadata = { title: "Settings" };

const configured = (...vars: (string | undefined)[]) => vars.every((v) => !!v && v.trim() !== "");

function integrations() {
  const db = driverName();
  const auth = authProviderName();
  const email = getEmailAdapter().name;
  const billing = getBillingAdapter().name;
  const stripeKeys = configured(process.env.STRIPE_SECRET_KEY, process.env.STRIPE_WEBHOOK_SECRET);
  const mapSetting = (process.env.NEXT_PUBLIC_MAP_PROVIDER ?? "leaflet").toLowerCase();
  const mapsOn = !["none", "off", "false"].includes(mapSetting);
  const ai = configured(process.env.ANTHROPIC_API_KEY);
  const supabaseStorage = process.env.STORAGE_PROVIDER === "supabase" && configured(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return [
    {
      name: "Database",
      active: db === "postgres" ? "PostgreSQL (Supabase)" : "Embedded PostgreSQL (PGlite, local demo)",
      detail: db === "postgres" ? "Connection string configured." : "Stored on this server. Switch to Supabase for production.",
      production: db === "postgres",
    },
    {
      name: "Sign-in",
      active: auth === "supabase" ? "Supabase Auth" : "Local accounts (encrypted passwords + signed session cookie)",
      detail: auth === "supabase" ? `Supabase project ${configured(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ? "configured" : "not configured"}.` : "No external service required.",
      production: auth === "supabase",
    },
    {
      name: "Email notifications",
      active: email === "resend" ? "Resend" : "Server log only (no email is sent)",
      detail: `Resend API key ${configured(process.env.RESEND_API_KEY) ? "configured" : "not configured"}. In-app notifications always work.`,
      production: email === "resend",
    },
    {
      name: "Billing",
      active: billing === "stripe" ? "Stripe (test mode)" : "Demo billing (no card collected, no charges)",
      detail: `Stripe keys ${stripeKeys ? "configured" : "not configured"}. Live keys are refused while demo mode is on.`,
      production: billing === "stripe",
    },
    {
      name: "Maps",
      active: mapsOn ? "OpenStreetMap (Leaflet)" : "Maps turned off (list view only)",
      detail: "The list view never depends on the map.",
      production: mapsOn,
    },
    {
      name: "AI-assisted discovery",
      active: ai ? "Anthropic Claude" : "Rules-based suggestions",
      detail: `Anthropic API key ${ai ? "configured" : "not configured"}. Every suggestion requires human review.`,
      production: ai,
    },
    {
      name: "File storage (logos)",
      active: supabaseStorage ? "Supabase Storage" : "Local files on this server",
      detail: supabaseStorage ? `Bucket: ${process.env.SUPABASE_STORAGE_BUCKET || "listing-media"}.` : "Uploads are kept in a private folder and served only after moderation.",
      production: supabaseStorage,
    },
  ];
}

export default async function AdminSettingsPage() {
  await requireRole(["super_admin"], "/admin/settings");
  const s = await getPlatformSettings();
  const lastUpdate = s.updated.filter((u) => u.updated_by_name).sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))[0];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Settings" }]}
        title="Platform settings"
        description="Super Administrators only. Changes take effect immediately and are recorded in the audit log."
      />
      <div className="grid gap-8 xl:grid-cols-[1fr_26rem]">
        <Section title="Settings">
          <Panel>
            {lastUpdate && (
              <p className="mb-4 text-sm text-muted-foreground">
                Last changed {formatDateTime(lastUpdate.updated_at)} by {lastUpdate.updated_by_name}.
              </p>
            )}
            <SettingsForm
              action={saveSettingsAction}
              defaults={{
                planName: s.enhanced_plan.name,
                planPrice: (s.enhanced_plan.price_cents / 100).toFixed(2),
                demoPricing: s.enhanced_plan.demo_pricing,
                verificationIntervalDays: s.verification_interval_days,
                lowResultThreshold: s.low_result_threshold,
                familyReportsEnabled: s.family_reports_enabled,
                defaultSearchRadius: s.default_search_radius_miles,
              }}
            />
          </Panel>
        </Section>

        <div className="flex flex-col gap-8">
          <Section title="Integrations status" description="Read-only. Each integration has a safe default so the platform works without outside accounts. Secret keys are never displayed.">
            <ul className="flex flex-col gap-3">
              {integrations().map((i) => (
                <li key={i.name} className="rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 font-bold">
                      <PlugZap className="size-4 text-primary" aria-hidden /> {i.name}
                    </h3>
                    <StatusPill tone={i.production ? "success" : "info"}>{i.production ? "Service connected" : "Built-in default"}</StatusPill>
                  </div>
                  <p className="mt-1">{i.active}</p>
                  <p className="text-sm text-muted-foreground">{i.detail}</p>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>

      <Section title="Data export & backups" className="mt-10" description="Your organization owns all MittenLink data. Export a full copy at any time.">
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel>
            <h3 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <Download className="size-5 text-primary" aria-hidden /> CSV exports
            </h3>
            <p className="mb-3 text-sm text-muted-foreground">Spreadsheet-ready files (UTF-8, one row per record). Exports include demo data flags and internal verification notes, so store them securely.</p>
            <ul className="flex flex-col gap-1">
              {Object.entries(EXPORT_DATASETS).map(([key, name]) => (
                <li key={key}>
                  <a href={`/admin/settings/export/${key}`} className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary underline" download>
                    <Download className="size-4" aria-hidden /> Download {name}
                    <span className="sr-only"> as CSV</span>
                  </a>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel>
            <h3 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <Database className="size-5 text-primary" aria-hidden /> Automated backups
            </h3>
            <ul className="ml-5 flex list-disc flex-col gap-2">
              <li>
                <strong>Daily database backups:</strong> the production database runs on Supabase, which takes automatic daily backups. Point-in-time recovery (PITR) can restore the
                database to any moment within the retention window.
              </li>
              <li>
                <strong>Full database dump:</strong> an administrator with database access can take a complete, portable copy at any time:
                <pre className="mt-2 overflow-x-auto rounded-lg bg-foreground p-3 text-sm text-background">pg_dump &quot;$DATABASE_URL&quot; --no-owner --format=custom --file=mittenlink-$(date +%F).dump</pre>
              </li>
              <li>
                <strong>Uploaded files:</strong> logos live in the Supabase Storage bucket (<code>listing-media</code>) and can be downloaded with the Supabase CLI or dashboard.
              </li>
              <li>
                <strong>No lock-in:</strong> the schema is standard PostgreSQL with version-controlled migrations, so the data can be restored to any PostgreSQL host.
              </li>
            </ul>
          </Panel>
        </div>
      </Section>
    </>
  );
}
