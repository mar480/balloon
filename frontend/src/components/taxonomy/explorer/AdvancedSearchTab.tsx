import React from "react";
import { Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AdvancedSearchFilterOptions,
  AdvancedSearchFilters,
  AdvancedSearchState,
} from "@/types/advancedSearch";

const EMPTY_FILTERS: AdvancedSearchFilters = {
  namespace: [],
  balance: [],
  periodType: [],
  xbrlType: [],
  fullType: [],
  abstract: [],
  nillable: [],
  substitutionGroup: [],
  referenceSource: null,
  referenceParagraph: null,
};

const EMPTY_FILTER_OPTIONS: AdvancedSearchFilterOptions = {
  namespace: [],
  balance: [],
  periodType: [],
  xbrlType: [],
  fullType: [],
  abstract: [true, false],
  nillable: [true, false],
  substitutionGroup: [],
  referenceSources: [],
};

interface AdvancedSearchTabProps {
  state?: AdvancedSearchState;
  filterOptions?: AdvancedSearchFilterOptions;
  referenceParagraphsBySource?: Record<string, string[]>;
  onQueryChange: (query: string) => void;
  onFiltersChange: (next: AdvancedSearchFilters) => void;
  onRunSearch: (nextOffset?: number) => void;
  onResetSearch: () => void;
  onNavigateToNode?: (qname: string) => void;
}

const FieldLabelWithHelp: React.FC<{ label: string; help: string }> = ({ label, help }) => (
  <div className="flex items-center gap-1">
    <span className="text-sm font-medium">{label}</span>
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="text-gray-400 hover:text-gray-600">
          <Info size={14} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs text-xs">
        {help}
      </TooltipContent>
    </Tooltip>
  </div>
);

function toggleString(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

function toggleBoolean(values: boolean[], value: boolean): boolean[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

const StringCheckboxGroup: React.FC<{
  label: string;
  help: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}> = ({ label, help, options, selected, onChange }) => (
  <div className="space-y-1">
    <FieldLabelWithHelp label={label} help={help} />
    <div className="border rounded p-2 max-h-40 overflow-auto space-y-1">
      {options.length === 0 ? (
        <div className="text-xs text-gray-500">No options available.</div>
      ) : (
        options.map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={selected.includes(opt)}
              onCheckedChange={() => onChange(toggleString(selected, opt))}
            />
            <span>{opt}</span>
          </label>
        ))
      )}
    </div>
  </div>
);

const BooleanCheckboxGroup: React.FC<{
  label: string;
  help: string;
  selected: boolean[];
  onChange: (next: boolean[]) => void;
}> = ({ label, help, selected, onChange }) => (
  <div className="space-y-1">
    <FieldLabelWithHelp label={label} help={help} />
    <div className="border rounded p-2 grid grid-cols-2 gap-2">
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={selected.includes(true)}
          onCheckedChange={() => onChange(toggleBoolean(selected, true))}
        />
        <span>true</span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={selected.includes(false)}
          onCheckedChange={() => onChange(toggleBoolean(selected, false))}
        />
        <span>false</span>
      </label>
    </div>
  </div>
);

const AdvancedSearchTab: React.FC<AdvancedSearchTabProps> = ({
  state,
  filterOptions,
  referenceParagraphsBySource,
  onQueryChange,
  onFiltersChange,
  onRunSearch,
  onResetSearch,
  onNavigateToNode,
}) => {
  const safeState: AdvancedSearchState = {
    query: state?.query ?? "",
    filters: { ...EMPTY_FILTERS, ...(state?.filters ?? {}) },
    results: state?.results ?? [],
    loading: state?.loading ?? false,
    error: state?.error ?? null,
    pagination: state?.pagination ?? { limit: 25, offset: 0, total: 0 },
    lastRunAt: state?.lastRunAt ?? null,
  };

  const safeFilterOptions = filterOptions ?? EMPTY_FILTER_OPTIONS;
  const safeReferenceParagraphsBySource = referenceParagraphsBySource ?? {};

  const { query, filters, results, loading, error, lastRunAt, pagination } = safeState;
  const { limit, offset, total } = pagination;
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;
  const from = total === 0 ? 0 : offset + 1;
  const to = total === 0 ? 0 : Math.min(offset + limit, total);

  const paragraphOptions =
    filters.referenceSource
      ? safeReferenceParagraphsBySource[filters.referenceSource] || []
      : [];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="p-4 space-y-4">
        {/* <div className="space-y-1"> */}
          {/* <p className="font-medium text-sm">Advanced Search</p> */}
          {/* <FieldLabelWithHelp
            label="Keyword"
            help="Free-text search term. Use this with filters below."
          />
          <input */}
            {/* type="text"
            className="border rounded p-2 text-sm w-full"
            placeholder="e.g. turnover, revenue, core:TurnoverRevenue"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onRunSearch(0);
              }
            }}
          /> */}
           <div className="flex items-end gap-2">
          <div className="space-y-1 flex-1 max-w-2xl">
            {/* <p className="font-medium text-sm">Advanced Search</p> */}
            <FieldLabelWithHelp
              label="Keyword"
              help="Free-text search term. Use this with filters below."
            />
            <input
              type="text"
              className="border rounded p-2 text-sm w-full"
              placeholder="e.g. turnover, revenue, core:TurnoverRevenue"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onRunSearch(0);
                }
              }}
            />
          </div>
          <div className="flex gap-2 pb-[1px]">
            <button
              className="bg-blue-600 text-white text-sm px-3 py-1 rounded disabled:opacity-50"
              onClick={() => onRunSearch(0)}
              disabled={loading}
            >
              {loading ? "Searching..." : "Search"}
            </button>
            <button className="bg-gray-200 text-sm px-3 py-1 rounded" onClick={onResetSearch}>
              Reset
            </button>
          </div>
        </div>


        <Accordion type="multiple" defaultValue={["search-filters", "references"]} className="w-full space-y-3">
          <AccordionItem value="search-filters" className="border rounded-md overflow-hidden">
            <AccordionTrigger className="py-2 px-2 text-sm font-semibold bg-blue-100 rounded">
              Search filters
            </AccordionTrigger>
            <AccordionContent className="pt-3 space-y-3">
                <div className="p-3 space-y-3">
              <StringCheckboxGroup
                label="Balance"
                help="Accounting balance type."
                options={safeFilterOptions.balance}
                selected={filters.balance}
                onChange={(next) => onFiltersChange({ ...filters, balance: next })}
              />
              <StringCheckboxGroup
                label="Period type"
                help="Duration or instant."
                options={safeFilterOptions.periodType}
                selected={filters.periodType}
                onChange={(next) => onFiltersChange({ ...filters, periodType: next })}
              />
              <StringCheckboxGroup
                label="XBRL type"
                help="Base XBRL type."
                options={safeFilterOptions.xbrlType}
                selected={filters.xbrlType}
                onChange={(next) => onFiltersChange({ ...filters, xbrlType: next })}
              /> </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="references" className="border rounded-md overflow-hidden">
            <AccordionTrigger className="py-2 px-2 text-sm font-semibold bg-blue-100 rounded">
              References
            </AccordionTrigger>
            <AccordionContent className="pt-3 space-y-3">
            <div className="p-3 space-y-3">               
               <FieldLabelWithHelp
                  label="Source"
                  help="Reference source, e.g. FRS 102."
                />
                <select
                  className="border rounded p-2 text-sm w-full bg-white"
                  value={filters.referenceSource || ""}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      referenceSource: e.target.value || null,
                      referenceParagraph: null,
                    })
                  }
                >
                  <option value="">Any source</option>
                  {safeFilterOptions.referenceSources.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>

                <FieldLabelWithHelp
                  label="Paragraph"
                  help="Paragraph list filtered by selected source."
                />
                <select
                  className="border rounded p-2 text-sm w-full bg-white"
                  value={filters.referenceParagraph || ""}
                  disabled={!filters.referenceSource}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      referenceParagraph: e.target.value || null,
                    })
                  }
                >
                  <option value="">Any paragraph</option>
                  {paragraphOptions.map((paragraph) => (
                    <option key={paragraph} value={paragraph}>
                      {paragraph}
                    </option>
                  ))}
                </select>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="advanced-xbrl" className="border rounded-md overflow-hidden">
            <AccordionTrigger className="py-2 px-2 text-sm font-semibold bg-blue-100 rounded">
              Advanced XBRL filters
            </AccordionTrigger>
            <AccordionContent className="pt-3 space-y-3">
              <div className="p-3 space-y-3">
              <StringCheckboxGroup
                label="Full type"
                help="Qualified type QName."
                options={safeFilterOptions.fullType}
                selected={filters.fullType}
                onChange={(next) => onFiltersChange({ ...filters, fullType: next })}
              />
              <BooleanCheckboxGroup
                label="Abstract"
                help="Whether concept is abstract."
                selected={filters.abstract}
                onChange={(next) => onFiltersChange({ ...filters, abstract: next })}
              />
              <BooleanCheckboxGroup
                label="Nillable"
                help="Whether concept is nillable."
                selected={filters.nillable}
                onChange={(next) => onFiltersChange({ ...filters, nillable: next })}
              />
              <StringCheckboxGroup
                label="Namespace"
                help="Concept namespace URI."
                options={safeFilterOptions.namespace}
                selected={filters.namespace}
                onChange={(next) => onFiltersChange({ ...filters, namespace: next })}
              />
              <StringCheckboxGroup
                label="Substitution group"
                help="Substitution group QName."
                options={safeFilterOptions.substitutionGroup}
                selected={filters.substitutionGroup}
                onChange={(next) => onFiltersChange({ ...filters, substitutionGroup: next })}
              />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex gap-2">
          <button
            className="bg-blue-600 text-white text-sm px-3 py-1 rounded disabled:opacity-50"
            onClick={() => onRunSearch(0)}
            disabled={loading}
          >
            {loading ? "Searching..." : "Search"}
          </button>
          <button className="bg-gray-200 text-sm px-3 py-1 rounded" onClick={onResetSearch}>
            Reset
          </button>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="border rounded">
          <div className="px-3 py-2 border-b bg-gray-50 text-xs text-gray-600">
             <div className="font-bold text-base text-gray-700">Search results</div>
<div className="mt-1">
              {lastRunAt ? `Last run: ${new Date(lastRunAt).toLocaleString()}` : "No search run yet"}
            </div>          </div>
          {results.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No results.</div>
          ) : (
            <ul className="divide-y">
              {results.map((result) => (
                <li key={result.id} className="p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm break-words">{result.label || result.qname}</div>
                    <div className="text-xs text-gray-500 break-all">{result.qname}</div>
                  </div>
                  <button
                    className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded  flex-shrink-0 w-20"
                    onClick={() => onNavigateToNode?.(result.qname)}
                  >
                    Go to node
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="px-3 py-2 border-t bg-gray-50 flex items-center justify-between text-xs text-gray-600">
            <span>
              Showing {from}-{to} of {total}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="px-2 py-1 rounded border bg-white disabled:opacity-50"
                disabled={loading || !hasPrev}
                onClick={() => onRunSearch(Math.max(0, offset - limit))}
              >
                Previous
              </button>
              <button
                type="button"
                className="px-2 py-1 rounded border bg-white disabled:opacity-50"
                disabled={loading || !hasNext}
                onClick={() => onRunSearch(offset + limit)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default AdvancedSearchTab;
