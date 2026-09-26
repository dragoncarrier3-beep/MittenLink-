"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlaceSuggestion } from "@/lib/search/types";

/**
 * WAI-ARIA combobox (list autocomplete) for Michigan cities, ZIP codes and
 * counties, backed by /api/places. Works as a plain text input without JS.
 */
export function LocationCombobox({
  value,
  onValueChange,
  onSelect,
  name = "location",
  label = "City, ZIP code, or county",
  hint,
  className,
  inputClassName,
}: {
  value: string;
  onValueChange: (v: string) => void;
  /** Called when a suggestion is chosen. */
  onSelect?: (s: PlaceSuggestion) => void;
  name?: string;
  label?: string;
  hint?: string;
  className?: string;
  inputClassName?: string;
}) {
  const id = useId();
  const inputId = `${id}-input`;
  const listId = `${id}-listbox`;
  const hintId = `${id}-hint`;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PlaceSuggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const skipNextFetch = useRef(false);

  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    if (timerRef.current) window.clearTimeout(timerRef.current);
    const q = value.trim();
    if (q.length < 2 && !/^\d$/.test(q)) {
      setItems([]);
      setOpen(false);
      return;
    }
    timerRef.current = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const json = (await res.json()) as { suggestions?: PlaceSuggestion[] };
        const list = json.suggestions ?? [];
        setItems(list);
        setActive(-1);
        const focused = document.activeElement?.id === inputId;
        setOpen(list.length > 0 && focused);
        setStatus(list.length ? `${list.length} location suggestion${list.length === 1 ? "" : "s"} available. Use the up and down arrow keys to review.` : "No matching Michigan locations.");
      } catch {
        // Aborted or offline: the field still works as free text.
      }
    }, 200);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [value, inputId]);

  const choose = (s: PlaceSuggestion) => {
    skipNextFetch.current = true;
    onValueChange(s.label);
    setOpen(false);
    setActive(-1);
    setStatus(`${s.label} selected.`);
    onSelect?.(s);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      if (!items.length) return;
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      if (!items.length) return;
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === "Enter") {
      if (open && active >= 0 && items[active]) {
        e.preventDefault();
        choose(items[active]);
      } else {
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      } else if (value) {
        e.preventDefault();
        onValueChange("");
      }
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const activeId = open && active >= 0 ? `${id}-opt-${active}` : undefined;

  return (
    <div className={cn("relative flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-base font-semibold text-foreground">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      <div className="relative">
        <MapPin className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          id={inputId}
          name={name}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-describedby={hint ? hintId : undefined}
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder="e.g. Ann Arbor, 49503, or Kent County"
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => items.length > 0 && value.trim().length >= 2 && setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          className={cn(
            "min-h-12 w-full rounded-lg border border-input bg-card py-2 pr-3 pl-10 text-base text-foreground placeholder:text-muted-foreground",
            inputClassName,
          )}
        />
        <ul
          id={listId}
          role="listbox"
          aria-label="Location suggestions"
          hidden={!open}
          className="absolute top-full right-0 left-0 z-40 mt-1 max-h-72 overflow-auto rounded-lg border bg-popover p-1 shadow-lg"
        >
          {items.map((s, i) => (
            <li
              key={s.id}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(s);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex min-h-11 cursor-pointer flex-col justify-center rounded-md px-3 py-1.5",
                i === active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
              )}
            >
              <span className="font-semibold">{s.label}</span>
              <span className={cn("text-sm", i === active ? "text-primary-foreground" : "text-muted-foreground")}>{s.detail}</span>
            </li>
          ))}
        </ul>
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {status}
      </span>
    </div>
  );
}
