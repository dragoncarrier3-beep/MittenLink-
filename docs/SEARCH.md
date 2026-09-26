# Search Architecture

Phase I search runs in PostgreSQL behind one SQL function, `public.search_listings(...)`. The website, a future mobile app, and any public API all get identical results and permissions.

## What is searched

One unified index covers organizations, services, programs, resources (guides), and events. Each `listings` row carries:

- **`search_vector`** (`tsvector`, GIN index), weighted as follows:
  - A: title, categories, disability types
  - B: summary
  - C: parent organization, populations, description
  - D: cities and counties
- **`search_text`**: plain lowercase text with a trigram GIN index, used for typo tolerance. It combines title, categories, organization, populations, disability types, cities, and counties.
- **`listing_points`**: every physical point (organization locations, service locations, event venues), GiST-indexed for radius search and the map.
- **`service_areas`**: statewide, county, or radius coverage.

Triggers keep all of these up to date whenever a record, its taxonomy, its locations, or its service areas change.

## Query processing

1. **Location parsing.** The app splits phrases like "Autism services near Ann Arbor" into a query ("Autism services") and a location ("Ann Arbor"), when the tail matches a known place.
2. **Query building.** `app.build_tsquery()`:
   - normalizes the text (lowercase, accents removed);
   - drops generic words (services, programs, near, help, …);
   - expands synonyms from the editable `search_synonyms` table (kids → children/pediatric/youth; job → employment; …);
   - builds an **AND** query with prefix matching.
3. **Matching.** A record matches if the full-text query matches, **or** if its trigram similarity to the query is high (word similarity ≥ 0.6, or title similarity ≥ 0.35). This is how "ocupational therapy" finds "Occupational Therapy".
4. **Ranking.** Rank is full-text rank plus trigram similarity, plus a small boost for verified records. **Enhanced (paid) listings get no ranking boost.**

## Geographic search

Locations are resolved from the built-in gazetteer, so no external geocoding service is needed. The gazetteer has two tables: `places` (cities and ZIP codes, with coordinates and county) and `counties` (all 83 Michigan counties).

When a search has a center point and a radius, each result gets a `match_scope`:

| Scope | Meaning |
|---|---|
| `nearby` | A physical location or venue is within the radius (distance is shown) |
| `serves_area` | A county or radius service area covers the searched area. Uses the county boundary polygon if loaded, otherwise the county centroid with a 10-mile tolerance |
| `statewide` | Statewide or virtual resource. **Always included**, so local searches never wrongly exclude statewide resources |
| `anywhere` | No location was given |

County searches match records located in, or serving, that county.

Results are ordered local first, then statewide. The function also returns `local_count` and `statewide_count`. The UI uses these to say "We couldn't find an exact match in this area" while still offering statewide options.

## Filters

All filters combine and are evaluated in SQL with indexes:
- category, population, record type
- delivery mode: in person, virtual, home based
- verified only, accepting new clients, free, insurance accepted
- wheelchair-accessible location, language, provider type

Results are paginated server-side (max 50 per page), so the browser never downloads the statewide dataset.

## Failed-search and gap analytics

The search service logs committed searches to `search_logs`: normalized query, county, radius, filters, result count, and outcome. Zero- and low-result searches are also aggregated into `failed_searches`; the "low" threshold is a platform setting. No personal identifiers are stored.

Admins review these under **Search Analytics**. There they can flag gaps (stored in `resource_gap_flags`) and turn them into Source Watch research tasks.

## Performance notes

- Indexes: GIN on `search_vector` and on `search_text` (trigram); GiST on geography; B-tree on foreign keys and statuses.
- `search_listings` is a security-invoker function, so RLS decides visibility without extra filtering in the app.
- For much larger datasets, precompute a materialized search table, or move to a dedicated search engine (next section).

## Migrating to a search service

The database stays the system of record. To adopt Meilisearch, Typesense, or Algolia later:

1. **Build an indexer** that reads `listings` plus its joins (the same fields as `search_text`). Include `_geo` points from `listing_points` and facet fields: categories, populations, delivery, verification, tier.
2. **Push changes** to the index using a Supabase database webhook, `LISTEN/NOTIFY` on `listings` updates, or a periodic job.
3. **Swap the implementation** behind `src/lib/search`. The UI and URL parameters stay the same. Keep failed-search logging in Postgres.
4. **Keep ranking payment-neutral.** If promoted placement is introduced, show it in a separately labeled slot.
