import Link from "next/link";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t bg-card">
      <div className="container-page grid gap-8 py-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-md text-muted-foreground">
            MittenLink is a statewide disability resource network operated by a Michigan nonprofit. We help people find trusted providers, programs, events, and practical
            information.
          </p>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            MittenLink verification confirms listing information. It is not a medical, legal, or professional endorsement of any provider.
          </p>
          <p className="mt-3 max-w-md rounded-lg bg-muted p-3 text-sm text-foreground">
            <strong>In an emergency, call 911.</strong> For a mental health crisis, call or text 988 (Suicide &amp; Crisis Lifeline).
          </p>
        </div>
        <nav aria-label="Find help">
          <h2 className="font-bold">Find help</h2>
          <ul className="mt-3 flex flex-col gap-2">
            <li><Link className="underline" href="/search">Find resources</Link></li>
            <li><Link className="underline" href="/providers">Providers</Link></li>
            <li><Link className="underline" href="/events">Events</Link></li>
            <li><Link className="underline" href="/guides">Plain-language guides</Link></li>
            <li><Link className="underline" href="/suggest">Tell us what you were looking for</Link></li>
          </ul>
        </nav>
        <nav aria-label="For organizations">
          <h2 className="font-bold">For organizations</h2>
          <ul className="mt-3 flex flex-col gap-2">
            <li><Link className="underline" href="/claim">Claim a provider</Link></li>
            <li><Link className="underline" href="/list-your-organization">List your organization</Link></li>
            <li><Link className="underline" href="/about#verification">How verification works</Link></li>
            <li><Link className="underline" href="/about#accessibility">Accessibility statement</Link></li>
            <li><Link className="underline" href="/about#privacy">Privacy</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t">
        <div className="container-page flex flex-col gap-2 py-4 text-sm text-muted-foreground md:flex-row md:justify-between">
          <p>© {new Date().getFullYear()} MittenLink — Michigan Disability Resource Network (Phase I demonstration).</p>
          <p>Built toward WCAG 2.2 AA. Report an accessibility barrier from the <Link href="/about#accessibility" className="underline">accessibility statement</Link>.</p>
        </div>
      </div>
    </footer>
  );
}
