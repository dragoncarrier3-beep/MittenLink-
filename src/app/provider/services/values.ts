import type { ServiceRecord } from "@/lib/data/provider";
import type { ServiceFormValues } from "./service-form";

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);

export const EMPTY_SERVICE: ServiceFormValues = {
  title: "",
  summary: "",
  description: "",
  eligibility: "",
  age_min: "",
  age_max: "",
  in_person: true,
  virtual_available: false,
  home_based: false,
  waitlist_status: "accepting",
  is_free: false,
  referral_required: false,
  payment_options: [],
  insurance_notes: "",
  payment_notes: "",
  contact_phone: "",
  contact_email: "",
  categories: [],
  populations: [],
  languages: [],
  location_ids: [],
};

export function serviceRaw(r: ServiceRecord): Record<string, unknown> {
  return { ...r };
}

export function toServiceForm(raw: Record<string, unknown>): ServiceFormValues {
  return {
    title: s(raw.title),
    summary: s(raw.summary),
    description: s(raw.description),
    eligibility: s(raw.eligibility),
    age_min: s(raw.age_min),
    age_max: s(raw.age_max),
    in_person: raw.in_person === true,
    virtual_available: raw.virtual_available === true,
    home_based: raw.home_based === true,
    waitlist_status: s(raw.waitlist_status) || "accepting",
    is_free: raw.is_free === true,
    referral_required: raw.referral_required === true,
    payment_options: arr(raw.payment_options),
    insurance_notes: s(raw.insurance_notes),
    payment_notes: s(raw.payment_notes),
    contact_phone: s(raw.contact_phone),
    contact_email: s(raw.contact_email),
    categories: arr(raw.categories),
    populations: arr(raw.populations),
    languages: arr(raw.languages),
    location_ids: arr(raw.location_ids),
  };
}
