import type { LocationRecord } from "@/lib/data/provider";
import { triValue } from "@/components/provider/constants";
import type { LocationFormValues } from "./location-form";

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export const EMPTY_LOCATION: LocationFormValues = {
  name: "",
  street: "",
  street2: "",
  city: "",
  zip: "",
  phone: "",
  email: "",
  hours: [],
  hours_note: "",
  wheelchair_accessible: "unknown",
  accessible_parking: "unknown",
  transit_info: "",
  appointment_required: false,
  virtual_services: false,
  status: "open",
};

/** Raw record-shaped values (booleans as booleans) so a pending proposal can be overlaid. */
export function locationRaw(l: LocationRecord) {
  return {
    name: l.name,
    street: l.street,
    street2: l.street2,
    city: l.city,
    zip: l.zip,
    phone: l.phone,
    email: l.email,
    hours: l.hours,
    hours_note: l.hours_note,
    wheelchair_accessible: l.wheelchair_accessible,
    accessible_parking: l.accessible_parking,
    transit_info: l.transit_info,
    appointment_required: l.appointment_required,
    virtual_services: l.virtual_services,
    status: l.status,
  } as Record<string, unknown>;
}

export function toLocationForm(raw: Record<string, unknown>): LocationFormValues {
  return {
    name: s(raw.name),
    street: s(raw.street),
    street2: s(raw.street2),
    city: s(raw.city),
    zip: s(raw.zip),
    phone: s(raw.phone),
    email: s(raw.email),
    hours: Array.isArray(raw.hours) ? (raw.hours as LocationFormValues["hours"]) : [],
    hours_note: s(raw.hours_note),
    wheelchair_accessible: triValue(raw.wheelchair_accessible as boolean | null),
    accessible_parking: triValue(raw.accessible_parking as boolean | null),
    transit_info: s(raw.transit_info),
    appointment_required: raw.appointment_required === true,
    virtual_services: raw.virtual_services === true,
    status: s(raw.status) || "open",
  };
}
