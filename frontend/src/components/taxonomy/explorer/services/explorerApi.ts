import { AdvancedSearchFilters } from "@/types/advancedSearch";

interface SearchConceptRequest {
  year: string;
  href: string;
  q: string;
  filters: AdvancedSearchFilters;
  limit: number;
  offset: number;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const payload = await response.json();
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error?: unknown }).error)
        : "Request failed";
    throw new Error(message);
  }
  return payload;
}

export async function fetchEntrypoints(year: string): Promise<{ name: string; href: string }[]> {
  const response = await fetch(`/api/entrypoints?year=${encodeURIComponent(year)}`);
  const payload = (await parseJsonResponse(response)) as { entrypoints?: { name: string; href: string }[] };
  return payload.entrypoints ?? [];
}

export async function loadEntrypoint(year: string, href: string): Promise<Record<string, unknown>> {
  const response = await fetch("/api/load-entrypoint", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ year, href }),
  });
  return (await parseJsonResponse(response)) as Record<string, unknown>;
}

export async function fetchSearchFilterOptions(
  year: string,
  href: string
): Promise<Record<string, unknown>> {
  const filtersUrl =
    `/api/search-filter-options?year=${encodeURIComponent(year)}` +
    `&href=${encodeURIComponent(href)}`;
  const response = await fetch(filtersUrl);
  return (await parseJsonResponse(response)) as Record<string, unknown>;
}

export async function searchConcepts(payload: SearchConceptRequest): Promise<Record<string, unknown>> {
  const response = await fetch("/api/search-concepts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return (await parseJsonResponse(response)) as Record<string, unknown>;
}

export async function warmConceptDetails(): Promise<void> {
  await fetch("/api/concept-details?qname=core:TurnoverRevenue");
}
