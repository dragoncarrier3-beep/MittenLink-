import { localParts } from "@/components/provider/constants";
import type { EventFormValues } from "./event-form";

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);

export const EMPTY_EVENT: EventFormValues = {
  title: "",
  summary: "",
  description: "",
  event_type: "workshop",
  start_date: "",
  start_time: "",
  end_date: "",
  end_time: "",
  venue_name: "",
  street: "",
  city: "",
  zip: "",
  is_in_person: true,
  virtual_available: false,
  registration_url: "",
  cost_text: "",
  is_free: true,
  accommodations: "",
  contact_email: "",
  contact_phone: "",
  categories: [],
  populations: [],
};

export function toEventForm(raw: Record<string, unknown>): EventFormValues {
  const start = localParts(raw.starts_at as Date | string | null);
  const end = localParts(raw.ends_at as Date | string | null);
  return {
    title: s(raw.title),
    summary: s(raw.summary),
    description: s(raw.description),
    event_type: s(raw.event_type) || "workshop",
    start_date: start.date,
    start_time: start.time,
    end_date: end.date && end.date !== start.date ? end.date : "",
    end_time: end.time,
    venue_name: s(raw.venue_name),
    street: s(raw.street),
    city: s(raw.city),
    zip: s(raw.zip),
    is_in_person: raw.is_in_person !== false,
    virtual_available: raw.virtual_available === true,
    registration_url: s(raw.registration_url),
    cost_text: s(raw.cost_text),
    is_free: raw.is_free !== false,
    accommodations: s(raw.accommodations),
    contact_email: s(raw.contact_email),
    contact_phone: s(raw.contact_phone),
    categories: arr(raw.categories),
    populations: arr(raw.populations),
  };
}
