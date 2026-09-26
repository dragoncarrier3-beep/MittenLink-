import { formatDateTime, formatDay, formatHours } from "@/lib/format";
import { EVENT_TYPE_LABELS, ORG_TYPE_LABELS, WAITLIST_LABELS, label } from "@/lib/labels";
import { LOCATION_STATUS_LABELS } from "./constants";

export interface DiffLookups {
  categories: Record<string, string>;
  populations: Record<string, string>;
  languages: Record<string, string>;
  paymentOptions: Record<string, string>;
  locations: Record<string, string>;
}

const LIST_LOOKUP: Record<string, keyof DiffLookups> = {
  categories: "categories",
  populations: "populations",
  languages: "languages",
  payment_options: "paymentOptions",
  location_ids: "locations",
};

const TRI_FIELDS = new Set(["wheelchair_accessible", "accessible_parking"]);

function Empty() {
  return <span className="text-muted-foreground italic">Not provided</span>;
}

export function formatChangeValue(field: string, value: unknown, lookups: DiffLookups): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    if (TRI_FIELDS.has(field)) return "Not sure / not listed";
    return <Empty />;
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (field in LIST_LOOKUP && Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground italic">None selected</span>;
    const map = lookups[LIST_LOOKUP[field]];
    return value.map((v) => map[String(v)] ?? String(v)).join(", ");
  }
  if (field === "hours" && Array.isArray(value)) {
    const rows = formatHours(value as { day: string; open: string; close: string }[]);
    if (!rows.length) return "Closed all week";
    return (
      <ul className="list-none">
        {rows.map((r) => (
          <li key={r.day}>
            {r.day}: {r.hours}
          </li>
        ))}
      </ul>
    );
  }
  if (field === "org_type") return label(ORG_TYPE_LABELS, String(value));
  if (field === "waitlist_status") return label(WAITLIST_LABELS, String(value));
  if (field === "event_type") return label(EVENT_TYPE_LABELS, String(value));
  if (field === "status") return label(LOCATION_STATUS_LABELS, String(value));
  if (field === "starts_at" || field === "ends_at") return formatDateTime(String(value));
  if (field === "start_date" || field === "end_date") return formatDay(String(value));
  const text = String(value);
  return <span className="whitespace-pre-line">{text}</span>;
}

/** Field-by-field comparison of the published value and the proposed value. */
export function ChangeDiff({
  proposed,
  current,
  isCreate,
  lookups,
  fieldLabels,
  caption,
}: {
  proposed: Record<string, unknown>;
  current: Record<string, unknown>;
  isCreate: boolean;
  lookups: DiffLookups;
  fieldLabels: Record<string, string>;
  caption: string;
}) {
  const fields = Object.keys(proposed);
  if (!fields.length) return <p className="text-muted-foreground">No field changes were recorded.</p>;
  return (
    <div>
      {/* Desktop */}
      <table className="hidden w-full border-collapse text-left text-sm md:table">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted">
          <tr>
            <th scope="col" className="w-1/5 px-3 py-2 font-bold">
              Field
            </th>
            {!isCreate && (
              <th scope="col" className="px-3 py-2 font-bold">
                Published value
              </th>
            )}
            <th scope="col" className="px-3 py-2 font-bold">
              {isCreate ? "Submitted value" : "Proposed value"}
            </th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f} className="border-t align-top">
              <th scope="row" className="px-3 py-2 font-semibold">
                {fieldLabels[f] ?? f}
              </th>
              {!isCreate && <td className="px-3 py-2">{formatChangeValue(f, current[f], lookups)}</td>}
              <td className="px-3 py-2">{formatChangeValue(f, proposed[f], lookups)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Mobile */}
      <dl className="flex flex-col gap-3 md:hidden" aria-label={caption}>
        {fields.map((f) => (
          <div key={f} className="rounded-lg border p-3 text-sm">
            <dt className="font-bold">{fieldLabels[f] ?? f}</dt>
            {!isCreate && (
              <dd className="mt-1">
                <span className="font-semibold text-muted-foreground">Published: </span>
                {formatChangeValue(f, current[f], lookups)}
              </dd>
            )}
            <dd className="mt-1">
              <span className="font-semibold text-muted-foreground">{isCreate ? "Submitted: " : "Proposed: "}</span>
              {formatChangeValue(f, proposed[f], lookups)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
