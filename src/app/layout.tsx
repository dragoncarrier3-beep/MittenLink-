import type { Metadata, Viewport } from "next";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource/atkinson-hyperlegible/400-italic.css";
import "./globals.css";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { DemoBanner } from "@/components/layout/demo-banner";

export const metadata: Metadata = {
  title: {
    default: "MittenLink — Michigan Disability Resource Network",
    template: "%s | MittenLink",
  },
  description:
    "Search providers, programs, services, events, and practical resources for individuals with disabilities, families, caregivers, and professionals across Michigan.",
  applicationName: "MittenLink",
};

export const viewport: Viewport = {
  themeColor: "#0b5780",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col antialiased">
        <a
          href="#main-content"
          className="sr-only z-50 rounded-lg bg-primary px-4 py-3 font-bold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to main content
        </a>
        <DemoBanner />
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
