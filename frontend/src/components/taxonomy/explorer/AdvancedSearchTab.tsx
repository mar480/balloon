import React from "react";
import {
  AdvancedSearchFacetKey,
  AdvancedSearchFilters,
  AdvancedSearchState,
} from "@/types/advancedSearch";

interface AdvancedSearchTabProps {
  state: AdvancedSearchState;
  onQueryChange: (query: string) => void;
  onFacetChange: (facet: AdvancedSearchFacetKey, values: string[]) => void;
  onRunSearch: () => void;
  onResetSearch: () => void;
  onNavigateToNode?: (qname: string) => void;
}

const FALLBACK_STATE: AdvancedSearchState = {
  query: "",
  filters: {
    xbrlTypes: [],
    periodTypes: [],
    referenceRoles: [],
    referenceNames: [],
  },
  results: [],
  loading: false,
  error: null,
  pagination: { limit: 25, offset: 0, total: 0 },
  lastRunAt: null,
};


const parseCsv = (value: string): string[] =>
  value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

const toCsv = (value: string[]): string => value.join(", ");

const AdvancedSearchTab: React.FC<AdvancedSearchTabProps> = ({
  state = FALLBACK_STATE,
  onQueryChange,
  onFacetChange,
  onRunSearch,
  onResetSearch,
  onNavigateToNode,
}) => {
  const { query, filters, results, loading, error, lastRunAt } = state;

  return (
    <div className="p-4 space-y-3">
      <div>
        <p className="font-medium text-sm">Advanced Search</p>
        <p className="text-xs text-gray-500">
          PR2 scaffolding: state is container-owned and persists across navigation.
        </p>
      </div>

      <div className="space-y-2">
        <input
          type="text"
          className="border rounded p-2 text-sm w-full"
          placeholder="Keyword (e.g. turnover, profit, core:TurnoverRevenue)"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />

        <input
          type="text"
          className="border rounded p-2 text-sm w-full"
          placeholder="XBRL types (comma separated)"
          value={toCsv(filters.xbrlTypes)}
          onChange={(e) => onFacetChange("xbrlTypes", parseCsv(e.target.value))}
        />

        <input
          type="text"
          className="border rounded p-2 text-sm w-full"
          placeholder="Period types (comma separated)"
          value={toCsv(filters.periodTypes)}
          onChange={(e) => onFacetChange("periodTypes", parseCsv(e.target.value))}
        />

        <input
          type="text"
          className="border rounded p-2 text-sm w-full"
          placeholder="Reference roles (comma separated)"
          value={toCsv(filters.referenceRoles)}
          onChange={(e) => onFacetChange("referenceRoles", parseCsv(e.target.value))}
        />

        <input
          type="text"
          className="border rounded p-2 text-sm w-full"
          placeholder="Reference names (comma separated)"
          value={toCsv(filters.referenceNames)}
          onChange={(e) => onFacetChange("referenceNames", parseCsv(e.target.value))}
        />

        <div className="flex gap-2">
          <button
            className="bg-blue-600 text-white text-sm px-3 py-1 rounded disabled:opacity-50"
            onClick={onRunSearch}
            disabled={loading}
          >
            {loading ? "Searching..." : "Search"}
          </button>

          <button
            className="bg-gray-200 text-sm px-3 py-1 rounded"
            onClick={onResetSearch}
          >
            Reset
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="border rounded">
        <div className="px-3 py-2 border-b bg-gray-50 text-xs text-gray-600">
          {lastRunAt ? `Last run: ${new Date(lastRunAt).toLocaleString()}` : "No search run yet"}
        </div>

        {results.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No results.</div>
        ) : (
          <ul className="divide-y">
            {results.map((result) => (
              <li key={result.id} className="p-3 flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-sm">{result.label || result.qname}</div>
                  <div className="text-xs text-gray-500">{result.qname}</div>
                </div>

                <button
                  className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
                  onClick={() => onNavigateToNode?.(result.qname)}
                >
                  Go to node
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AdvancedSearchTab;