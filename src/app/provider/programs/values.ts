import { dateOnly } from "@/components/provider/constants";
import type { ProgramFormValues } from "./program-form";

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);

export const EMPTY_PROGRAM: ProgramFormValues = {
  title: "",
  summary: "",
  description: "",
  eligibility: "",
  cost_text: "",
  is_free: false,
  application_instructions: "",
  start_date: "",
  end_date: "",
  website: "",
  contact_email: "",
  contact_phone: "",
  virtual_available: false,
  categories: [],
  populations: [],
};

export function toProgramForm(raw: Record<string, unknown>): ProgramFormValues {
  return {
    title: s(raw.title),
    summary: s(raw.summary),
    description: s(raw.description),
    eligibility: s(raw.eligibility),
    cost_text: s(raw.cost_text),
    is_free: raw.is_free === true,
    application_instructions: s(raw.application_instructions),
    start_date: dateOnly(raw.start_date as Date | string | null),
    end_date: dateOnly(raw.end_date as Date | string | null),
    website: s(raw.website),
    contact_email: s(raw.contact_email),
    contact_phone: s(raw.contact_phone),
    virtual_available: raw.virtual_available === true,
    categories: arr(raw.categories),
    populations: arr(raw.populations),
  };
}
