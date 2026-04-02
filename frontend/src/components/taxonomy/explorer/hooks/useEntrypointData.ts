import { useEffect, useState } from "react";
import {
  mapSearchOptionsPayload,
  mapTreesPayloadToNetworkMap,
} from "@/components/taxonomy/explorer/explorerDataUtils";
import {
  EMPTY_ADVANCED_FILTER_OPTIONS,
  EXCLUDED_TREE_KEYS,
  RawElrGroup,
} from "@/components/taxonomy/explorer/explorerTypes";
import {
  EntrypointRecord,
  fetchEntrypoints,
  fetchSearchFilterOptions,
  loadEntrypoint,
} from "../services/explorerApi";

type UseEntrypointDataArgs = {
  year: string | null;
  entrypoint: string | null;
  onEntrypointReset: () => void;
};

export function useEntrypointData({ year, entrypoint, onEntrypointReset }: UseEntrypointDataArgs) {
  const [entrypoints, setEntrypoints] = useState<EntrypointRecord[]>([]);
  const [rawTreeData, setRawTreeData] = useState<Record<string, RawElrGroup[]>>({});
  const [entrypointLoaded, setEntrypointLoaded] = useState(false);
  const [loadingEntrypoint, setLoadingEntrypoint] = useState(false);
  const [advancedSearchFilterOptions, setAdvancedSearchFilterOptions] = useState(
    EMPTY_ADVANCED_FILTER_OPTIONS
  );
  const [referenceParagraphsBySource, setReferenceParagraphsBySource] = useState<
    Record<string, string[]>
  >({});

  useEffect(() => {
    if (!year) return;
    fetchEntrypoints(year)
      .then((data) => {
        setEntrypoints(data || []);
      })
      .catch((err) => {
        console.error("Failed to fetch entrypoints", err);
        setEntrypoints([]);
      });
  }, [year]);

  useEffect(() => {
    if (!year || !entrypoint) return;

    setEntrypointLoaded(false);
    setLoadingEntrypoint(true);
    setRawTreeData({});
    setAdvancedSearchFilterOptions(EMPTY_ADVANCED_FILTER_OPTIONS);
    setReferenceParagraphsBySource({});
    onEntrypointReset();

    loadEntrypoint(year, entrypoint)
      .then((data) => {
        if (data.status !== "loaded") {
          console.error("Load error:", data.error);
          setLoadingEntrypoint(false);
          return;
        }

        setRawTreeData(mapTreesPayloadToNetworkMap(data.trees || {}, EXCLUDED_TREE_KEYS));

        fetchSearchFilterOptions(year, entrypoint)
          .then((opts) => {
            setAdvancedSearchFilterOptions(mapSearchOptionsPayload(opts));
            setReferenceParagraphsBySource(opts.referenceParagraphsBySource ?? {});
          })
          .catch((err) => {
            console.error("Failed to load search filter options", err);
            setAdvancedSearchFilterOptions(EMPTY_ADVANCED_FILTER_OPTIONS);
            setReferenceParagraphsBySource({});
          });

        setEntrypointLoaded(true);
        setLoadingEntrypoint(false);
      })
      .catch((err) => {
        console.error("Failed to load entrypoint", err);
        setLoadingEntrypoint(false);
      });
  }, [entrypoint, year, onEntrypointReset]);

  return {
    entrypoints,
    rawTreeData,
    entrypointLoaded,
    loadingEntrypoint,
    advancedSearchFilterOptions,
    referenceParagraphsBySource,
  };
}
