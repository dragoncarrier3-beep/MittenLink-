"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { DELIVERY, DELIVERY_LABELS, KINDS, type SearchParams } from "@/lib/search/params";
import { KIND_PLURAL } from "@/lib/labels";
import type { FilterOptions } from "@/lib/search/types";

type ArrayKey = "category" | "population" | "delivery" | "kind";
type FlagKey = "verified" | "accepting" | "free" | "insurance" | "accessible";

const FLAGS: { key: FlagKey; label: string; hint?: string }[] = [
  { key: "verified", label: "Verified resources", hint: "Reviewed by MittenLink" },
  { key: "accepting", label: "Accepting new clients" },
  { key: "free", label: "Free services" },
  { key: "insurance", label: "Insurance accepted" },
  { key: "accessible", label: "Accessible location", hint: "Wheelchair-accessible building" },
];

/**
 * Search refinement filters. Controlled: every change calls onChange with the
 * next parameters. Uses native inputs so the enclosing GET form also works
 * without JavaScript.
 */
export function FilterPanel({
  value,
  onChange,
  options,
  idPrefix,
}: {
  value: SearchParams;
  onChange: (next: SearchParams) => void;
  options: FilterOptions;
  idPrefix: string;
}) {
  const toggle = (key: ArrayKey, v: string) => {
    const list = value[key] as string[];
    const next = list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
    onChange({ ...value, [key]: next, page: 1 });
  };
  const featured = options.categories.slice(0, 12);
  const more = options.categories.slice(12);
  const moreSelected = more.some((c) => value.category.includes(c.slug));

  return (
    <div className="flex flex-col gap-6">
      <CheckGroup legend="Record type" idPrefix={`${idPrefix}-kind`}>
        {KINDS.map((k) => (
          <Check key={k} name="kind" value={k} label={KIND_PLURAL[k]} checked={value.kind.includes(k)} onChange={() => toggle("kind", k)} />
        ))}
      </CheckGroup>

      <CheckGroup legend="Category" idPrefix={`${idPrefix}-cat`}>
        {featured.map((c) => (
          <Check key={c.slug} name="category" value={c.slug} label={c.name} checked={value.category.includes(c.slug)} onChange={() => toggle("category", c.slug)} />
        ))}
        {more.length > 0 && (
          <details open={moreSelected} className="group">
            <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-primary underline">
              More categories ({more.length})
            </summary>
            <div className="mt-1 flex flex-col gap-1">
              {more.map((c) => (
                <Check key={c.slug} name="category" value={c.slug} label={c.name} checked={value.category.includes(c.slug)} onChange={() => toggle("category", c.slug)} />
              ))}
            </div>
          </details>
        )}
      </CheckGroup>

      <CheckGroup legend="Population" idPrefix={`${idPrefix}-pop`}>
        {options.populations.map((p) => (
          <Check key={p.slug} name="population" value={p.slug} label={p.name} checked={value.population.includes(p.slug)} onChange={() => toggle("population", p.slug)} />
        ))}
      </CheckGroup>

      <CheckGroup legend="Service delivery" idPrefix={`${idPrefix}-del`}>
        {DELIVERY.map((d) => (
          <Check key={d} name="delivery" value={d} label={DELIVERY_LABELS[d]} checked={value.delivery.includes(d)} onChange={() => toggle("delivery", d)} />
        ))}
      </CheckGroup>

      <CheckGroup legend="Other" idPrefix={`${idPrefix}-other`}>
        {FLAGS.map((f) => (
          <Check
            key={f.key}
            name={f.key}
            value="1"
            label={f.label}
            hint={f.hint}
            checked={value[f.key]}
            onChange={() => onChange({ ...value, [f.key]: !value[f.key], page: 1 })}
          />
        ))}
        <SelectRow
          label="Language"
          name="language"
          value={value.language}
          onChange={(v) => onChange({ ...value, language: v, page: 1 })}
          options={[{ value: "", label: "Any language" }, ...options.languages.map((l) => ({ value: l.code, label: l.name }))]}
        />
        <SelectRow
          label="Provider type"
          name="orgType"
          value={value.orgType}
          onChange={(v) => onChange({ ...value, orgType: v, page: 1 })}
          options={[{ value: "", label: "Any provider type" }, ...options.orgTypes]}
        />
      </CheckGroup>
    </div>
  );
}

function CheckGroup({ legend, children, idPrefix }: { legend: string; children: React.ReactNode; idPrefix: string }) {
  return (
    <fieldset aria-describedby={undefined} id={idPrefix} className="flex flex-col gap-1 border-t pt-4 first:border-t-0 first:pt-0">
      <legend className="mb-2 text-lg font-bold text-foreground">{legend}</legend>
      {children}
    </fieldset>
  );
}

function Check({ name, value, label, hint, checked, onChange }: { name: string; value: string; label: string; hint?: string; checked: boolean; onChange: () => void }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-3 size-5 shrink-0 cursor-pointer accent-[var(--primary)]"
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      <label htmlFor={id} className="flex min-h-11 cursor-pointer flex-col justify-center py-1 text-base text-foreground">
        <span>{label}</span>
        {hint && (
          <span id={`${id}-hint`} className="text-sm text-muted-foreground">
            {hint}
          </span>
        )}
      </label>
    </div>
  );
}

function SelectRow({
  label,
  name,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("mt-2 flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="font-semibold text-foreground">
        {label}
      </label>
      <select id={id} name={name} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-11 w-full rounded-lg border border-input bg-card px-3 text-base">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
