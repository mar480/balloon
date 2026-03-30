export type AdvancedSearchFacetKey =
  | "xbrlTypes"
  | "periodTypes"
  | "referenceRoles"
  | "referenceNames";

export interface AdvancedSearchFilters {
  xbrlTypes: string[];
  periodTypes: string[];
  referenceRoles: string[];
  referenceNames: string[];
}

export interface AdvancedSearchResult {
  id: string;
  qname: string;
  localName?: string;
  label?: string;
  score?: number;
  matchedFields?: string[];
}

export interface AdvancedSearchPagination {
  limit: number;
  offset: number;
  total: number;
}

export interface AdvancedSearchState {
  query: string;
  filters: AdvancedSearchFilters;
  results: AdvancedSearchResult[];
  loading: boolean;
  error: string | null;
  pagination: AdvancedSearchPagination;
  lastRunAt: string | null;
}

export interface AdvancedSearchFilters {
  namespace: string[];
  balance: string[];
  periodType: string[];
  xbrlType: string[];
  fullType: string[];
  abstract: boolean[]; // allows none / true / false / both
  nillable: boolean[]; // allows none / true / false / both
  substitutionGroup: string[];
  referenceSource: string | null;   // dropdown
  referenceParagraph: string | null; // dropdown dependent on source
}