import { Check, Minus } from "lucide-react";

const SIGNAL_LABELS: [string, string][] = [
  ["same_website_domain", "Same website domain"],
  ["same_phone", "Same phone"],
  ["same_address", "Same address"],
  ["same_zip", "Same ZIP code"],
  ["same_email", "Same email"],
];

/** Duplicate-detection signals as text (never color alone). */
export function DuplicateSignals({ signals, compact = false }: { signals: Record<string, unknown>; compact?: boolean }) {
  const sim = typeof signals.name_similarity === "number" ? Math.round(signals.name_similarity * 100) : null;
  const items = SIGNAL_LABELS.filter(([k]) => k in signals).map(([k, label]) => ({ label, match: signals[k] === true }));
  if (compact) {
    const matched = items.filter((i) => i.match).map((i) => i.label);
    return (
      <span className="text-sm">
        {sim !== null ? `Name similarity ${sim}%` : "Name similarity not recorded"}
        {matched.length ? ` · ${matched.join(" · ")}` : " · No other matching details"}
        {typeof signals.shared_city === "string" ? ` · Same city (${signals.shared_city})` : ""}
      </span>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {sim !== null && (
        <li className="flex items-center gap-2">
          <span className="font-semibold">Name similarity:</span> {sim}%
        </li>
      )}
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          {i.match ? <Check className="size-4 text-success" aria-hidden /> : <Minus className="size-4 text-muted-foreground" aria-hidden />}
          <span>
            {i.label}: <strong>{i.match ? "Match" : "No match"}</strong>
          </span>
        </li>
      ))}
    </ul>
  );
}
