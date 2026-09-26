"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", background: "#fbfaf6", color: "#1b2430" }}>
        <main>
          <h1>MittenLink is temporarily unavailable</h1>
          <p>We&apos;re having trouble loading resources right now. Please try again.</p>
          <button type="button" onClick={reset} style={{ minHeight: 44, padding: "0 1rem", fontSize: "1rem" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
