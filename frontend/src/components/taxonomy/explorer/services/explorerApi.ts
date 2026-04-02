export type EntrypointRecord = { name: string; href: string };

export async function fetchEntrypoints(year: string): Promise<EntrypointRecord[]> {
  const response = await fetch(`/api/entrypoints?year=${year}`);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || "Failed to fetch entrypoints");
  }
  return payload.entrypoints || [];
}

export async function loadEntrypoint(year: string, href: string): Promise<any> {
  const response = await fetch("/api/load-entrypoint", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ year, href }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || "Failed to load entrypoint");
  }
  return payload;
}

export async function fetchSearchFilterOptions(year: string, href: string): Promise<any> {
  const filtersUrl =
    `/api/search-filter-options?year=${encodeURIComponent(year)}` +
    `&href=${encodeURIComponent(href)}`;

  const response = await fetch(filtersUrl);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || "Failed to load search filter options");
  }
  return payload;
}

export async function searchConcepts(payload: {
  year: string;
  href: string;
  q: string;
  filters: Record<string, unknown>;
  limit: number;
  offset: number;
}): Promise<any> {
  const response = await fetch("/api/search-concepts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error || "Search request failed");
  }
  return body;
}
