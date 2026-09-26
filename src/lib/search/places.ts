import "server-only";
import type { SqlClient } from "@/lib/db";
import type { PlaceSuggestion, ResolvedLocation } from "./types";

/** Normalize free-text location input ("Ann Arbor, MI" → "ann arbor"). */
export function normalizeLocationText(text: string) {
  return text
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/,?\s*(mi|michigan)\.?\s*$/i, "")
    .replace(/\bsaint\b/g, "st.")
    .replace(/\bst\s/g, "st. ")
    .replace(/[,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type PlaceRow = { name: string; zip: string | null; county_id: number; county_name: string; lat: number; lng: number };
type CountyRow = { id: number; name: string; lat: number; lng: number };

const PLACE_COLS = `p.name, p.zip, p.county_id, c.name as county_name,
  extensions.st_y(p.geog::extensions.geometry) as lat, extensions.st_x(p.geog::extensions.geometry) as lng`;

/**
 * Resolve a city, ZIP code or county name to a location using the local
 * gazetteer (`places` + `counties`). Returns null when nothing matches.
 */
export async function resolvePlace(sql: SqlClient, text: string, radius: number | null, defaultRadius: number): Promise<ResolvedLocation | null> {
  const raw = text.trim();
  if (!raw) return null;
  const zipMatch = raw.match(/\b(4[89]\d{3})\b/);
  if (zipMatch) {
    const [row] = await sql.query<PlaceRow>(
      `select ${PLACE_COLS} from public.places p join public.counties c on c.id = p.county_id where p.kind = 'zip' and p.zip = $1 limit 1`,
      [zipMatch[1]],
    );
    if (row) return { kind: "zip", label: zipMatch[1], countyId: row.county_id, countyName: row.county_name, lat: row.lat, lng: row.lng, radius: radius ?? defaultRadius };
  }

  const norm = normalizeLocationText(raw);
  if (!norm || norm.length < 2) return null;
  const countyOnly = /\bcounty$/.test(norm);
  const countyName = norm.replace(/\s*\bcounty$/, "").trim();

  const findCounty = async (exact: boolean) => {
    const rows = await sql.query<CountyRow>(
      exact
        ? `select id, name, extensions.st_y(centroid::extensions.geometry) as lat, extensions.st_x(centroid::extensions.geometry) as lng
           from public.counties where lower(name) = $1 limit 1`
        : `select id, name, extensions.st_y(centroid::extensions.geometry) as lat, extensions.st_x(centroid::extensions.geometry) as lng
           from public.counties where extensions.similarity(lower(name), $1) >= 0.45
           order by extensions.similarity(lower(name), $1) desc limit 1`,
      [countyName],
    );
    const c = rows[0];
    return c ? ({ kind: "county", label: `${c.name} County`, countyId: c.id, countyName: c.name, lat: c.lat, lng: c.lng, radius: null } satisfies ResolvedLocation) : null;
  };

  if (countyOnly) {
    return (await findCounty(true)) ?? (await findCounty(false));
  }

  const [city] = await sql.query<PlaceRow>(
    `select ${PLACE_COLS} from public.places p join public.counties c on c.id = p.county_id
     where p.kind = 'city' and lower(p.name) = $1 order by p.population desc nulls last limit 1`,
    [norm],
  );
  if (city) return { kind: "city", label: city.name, countyId: city.county_id, countyName: city.county_name, lat: city.lat, lng: city.lng, radius: radius ?? defaultRadius };

  const exactCounty = await findCounty(true);
  if (exactCounty) return exactCounty;

  // Typo tolerance for city names ("Ann Arbr").
  const [fuzzy] = await sql.query<PlaceRow>(
    `select ${PLACE_COLS} from public.places p join public.counties c on c.id = p.county_id
     where p.kind = 'city' and extensions.similarity(lower(p.name), $1) >= 0.45
     order by extensions.similarity(lower(p.name), $1) desc limit 1`,
    [norm],
  );
  if (fuzzy) return { kind: "city", label: fuzzy.name, countyId: fuzzy.county_id, countyName: fuzzy.county_name, lat: fuzzy.lat, lng: fuzzy.lng, radius: radius ?? defaultRadius };

  return findCounty(false);
}

/** Only exact (non-fuzzy) place names — used to split natural-language queries safely. */
export async function isExactPlace(sql: SqlClient, text: string): Promise<boolean> {
  const t = text.trim();
  if (/^4[89]\d{3}$/.test(t)) {
    const rows = await sql.query("select 1 from public.places where kind = 'zip' and zip = $1 limit 1", [t]);
    return rows.length > 0;
  }
  const norm = normalizeLocationText(t);
  if (!norm) return false;
  const countyName = norm.replace(/\s*\bcounty$/, "").trim();
  const rows = await sql.query(
    `select 1 from public.places where kind = 'city' and lower(name) = $1
     union all select 1 from public.counties where lower(name) = $2 limit 1`,
    [norm, countyName],
  );
  return rows.length > 0;
}

/** Autocomplete suggestions for the location combobox. */
export async function suggestPlaces(sql: SqlClient, text: string, limit = 8): Promise<PlaceSuggestion[]> {
  const raw = text.trim();
  if (!raw) return [];
  if (/^\d{1,5}$/.test(raw)) {
    const rows = await sql.query<{ zip: string; name: string; county: string }>(
      `select p.zip, p.name, c.name as county from public.places p join public.counties c on c.id = p.county_id
       where p.kind = 'zip' and p.zip like $1 order by p.zip limit $2`,
      [`${raw}%`, limit],
    );
    return rows.map((r) => ({ id: `zip-${r.zip}`, kind: "zip", label: r.zip, detail: `${r.name}, ${r.county} County` }));
  }
  const norm = normalizeLocationText(raw).replace(/\s*\bcounty$/, "");
  if (!norm) return [];
  const rows = await sql.query<{ kind: "city" | "county"; name: string; county: string; score: number }>(
    `select * from (
       select 'city' as kind, p.name, c.name as county,
         case when lower(p.name) like $1 || '%' then 2 else 0 end + extensions.similarity(lower(p.name), $1) as score
       from public.places p join public.counties c on c.id = p.county_id
       where p.kind = 'city' and (lower(p.name) like $1 || '%' or lower(p.name) like '% ' || $1 || '%' or extensions.similarity(lower(p.name), $1) >= 0.35)
       union all
       select 'county' as kind, c.name, c.name as county,
         case when lower(c.name) like $1 || '%' then 1.9 else 0 end + extensions.similarity(lower(c.name), $1) as score
       from public.counties c
       where lower(c.name) like $1 || '%' or extensions.similarity(lower(c.name), $1) >= 0.35
     ) x order by score desc, name limit $2`,
    [norm, limit],
  );
  return rows.map((r) =>
    r.kind === "city"
      ? { id: `city-${r.name}`, kind: "city", label: r.name, detail: `City in ${r.county} County` }
      : { id: `county-${r.name}`, kind: "county", label: `${r.name} County`, detail: "County-wide" },
  );
}
