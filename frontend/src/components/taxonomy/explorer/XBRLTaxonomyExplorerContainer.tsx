import React, { useState, useEffect, useMemo, useCallback } from "react";
import XBRLTaxonomyExplorer from "./XBRLTaxonomyExplorer";
import Loader from "@/components/loader/Loader";
import "@/components/loader/loader.scss";
import {
  TreeNode,
  mapElrGroupedTreeToTreeNodes,
} from "@/components/taxonomy/explorer/tree_utils";
import { TreeLocationTarget } from "./TreeLocationsTab";
import {
  chooseNavigationMatcher,
  collectTreeLocations,
  findPathInTreeNodes,
} from "./navigationUtils";
import { NAV_LOG_PREFIX, PendingNavigation } from "./explorerTypes";
import { useAdvancedSearch } from "./hooks/useAdvancedSearch";
import { useEntrypointData } from "./hooks/useEntrypointData";

const XBRLTaxonomyExplorerContainer: React.FC = () => {
  // UI state
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [detailNode, setDetailNode] = useState<TreeNode | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<{ [key: string]: boolean }>({});
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const [language, setLanguage] = useState<"en" | "cy">("en");
  const [network, setNetwork] = useState<string>("");

  // Taxonomy selection state
  const [year, setYear] = useState<string | null>(null);
  const [entrypoint, setEntrypoint] = useState<string | null>(null);

  // navigation queue (for cross-network jumps)
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);

  const {
    advancedSearchState,
    resetAdvancedSearch,
    updateAdvancedSearchQuery,
    updateAdvancedSearchFilters,
    runAdvancedSearch,
  } = useAdvancedSearch(year, entrypoint);

  const clearTreeUiState = useCallback(() => {
    setNetwork("");
    setSelectedNode(null);
    setDetailNode(null);
    setExpandedKeys({});
    setHighlightedKey(null);
    setPendingNavigation(null);
  }, []);

  const {
    entrypoints,
    rawTreeData,
    entrypointLoaded,
    loadingEntrypoint,
    advancedSearchFilterOptions,
    referenceParagraphsBySource,
  } = useEntrypointData(year, entrypoint, resetAdvancedSearch, clearTreeUiState);

  const currentTreeNodes: TreeNode[] = useMemo(() => {
    const raw = rawTreeData?.[network];
    if (!raw || !Array.isArray(raw)) return [];
    return mapElrGroupedTreeToTreeNodes(raw);
  }, [rawTreeData, network]);

  // Default network
  useEffect(() => {
    if (!entrypointLoaded || !Object.keys(rawTreeData).length) return;

    if (!network || !rawTreeData[network]) {
      const preferred = rawTreeData.presentation ? "presentation" : Object.keys(rawTreeData)[0];
      if (preferred) setNetwork(preferred);
    }
  }, [rawTreeData, entrypointLoaded, network]);

  const expandPathToQName = useCallback(
    (targetQName: string, options?: { preserveDetails?: boolean }) => {
      const path = findPathInTreeNodes(
        currentTreeNodes,
        (node) => node.data?.qname === targetQName
      );
      if (!path) return;

      const expanded: Record<string, boolean> = {};
      for (const node of path) expanded[node.key] = true;
      setExpandedKeys((prev) => ({ ...prev, ...expanded }));

      const target = path[path.length - 1];
      setHighlightedKey(target.key);
      setTimeout(() => setHighlightedKey(null), 5000);
      setSelectedNode(target);
      if (!options?.preserveDetails) {
        setDetailNode(target);
      }
    },
    [currentTreeNodes]
  );

  const treeLocations = useMemo<TreeLocationTarget[]>(
    () => collectTreeLocations(rawTreeData, detailNode?.data?.qname),
    [rawTreeData, detailNode?.data?.qname]
  );

  const navigateToLocation = useCallback(
    (target: TreeLocationTarget) => {
      console.debug(`${NAV_LOG_PREFIX} request`, {
        fromNetwork: network,
        toNetwork: target.network,
        qname: target.qname,
        uuid: target.uuid,
        treeId: target.treeId,
        label: target.label,
        elr: target.elr,
      });

      setPendingNavigation({
        network: target.network,
        elr: target.elr,
        qname: target.qname,
        uuid: target.uuid,
        updateDetails: true,
      });

      if (network !== target.network) {
        setNetwork(target.network);
        setExpandedKeys({});
        setHighlightedKey(null);
      }
    },
    [network]
  );

  useEffect(() => {
    if (!pendingNavigation) return;
    if (network !== pendingNavigation.network) return;

    const { matcher, matchStrategy, uuidMatches, elrQNameMatches, qnameMatches } =
      chooseNavigationMatcher(currentTreeNodes, pendingNavigation);

    console.debug(`${NAV_LOG_PREFIX} candidates`, {
      network,
      requested: pendingNavigation,
      uuidMatches: uuidMatches.length,
      elrQNameMatches: elrQNameMatches.length,
      qnameMatches: qnameMatches.length,
      using: matchStrategy,
    });

    const path = findPathInTreeNodes(currentTreeNodes, matcher) ?? null;

    if (!path) {
      console.warn(`${NAV_LOG_PREFIX} no path found`, {
        network,
        requested: pendingNavigation,
      });
      return;
    }

    const expanded: Record<string, boolean> = {};
    for (const node of path) expanded[node.key] = true;
    setExpandedKeys((prev) => ({ ...prev, ...expanded }));

    const targetNode = path[path.length - 1];
    setSelectedNode(targetNode);
    if (pendingNavigation.updateDetails !== false) {
      setDetailNode(targetNode);
    }
    setHighlightedKey(targetNode.key);
    setTimeout(() => setHighlightedKey(null), 5000);

    console.debug(`${NAV_LOG_PREFIX} resolved`, {
      using: matchStrategy,
      targetKey: targetNode.key,
      targetQname: targetNode.data?.qname,
      targetUuid: targetNode.data?.uuid,
      targetTreeId: targetNode.data?.treeId,
      pathDepth: path.length,
    });

    setPendingNavigation(null);
  }, [pendingNavigation, network, currentTreeNodes]);

  return (
    <>
      {loadingEntrypoint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-90 transition-opacity duration-300">
          <Loader />
        </div>
      )}

      <XBRLTaxonomyExplorer
        selectedNode={selectedNode}
        detailNode={detailNode}
        expandedKeys={expandedKeys}
        highlightedKey={highlightedKey}
        language={language}
        network={network}
        year={year}
        entrypoint={entrypoint}
        entrypoints={entrypoints}
        onYearChange={setYear}
        onEntrypointChange={setEntrypoint}
        onSelectNode={(node) => {
          setSelectedNode(node);
          setDetailNode(node);
        }}
        onExpandedKeysChange={setExpandedKeys}
        onLanguageChange={setLanguage}
        onNetworkChange={(val) => {
          if (entrypointLoaded && rawTreeData[val]) {
            setNetwork(val);
            setExpandedKeys({});
            setHighlightedKey(null);
          } else {
            console.warn("[NetworkChange] Ignored invalid or unloaded network:", val);
          }
        }}
        onNavigateToNode={expandPathToQName}
        onNavigateToLocation={navigateToLocation}
        currentTreeNodes={currentTreeNodes}
        entrypointLoaded={entrypointLoaded}
        treeLocations={treeLocations}
        advancedSearchState={advancedSearchState}
        advancedSearchFilterOptions={advancedSearchFilterOptions}
        referenceParagraphsBySource={referenceParagraphsBySource}
        onAdvancedSearchQueryChange={updateAdvancedSearchQuery}
        onAdvancedSearchFiltersChange={updateAdvancedSearchFilters}
        onRunAdvancedSearch={runAdvancedSearch}
        onResetAdvancedSearch={resetAdvancedSearch}
      />
    </>
  );
};

export default XBRLTaxonomyExplorerContainer;
