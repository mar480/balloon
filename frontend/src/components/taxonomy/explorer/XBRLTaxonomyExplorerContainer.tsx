import React, { useState, useEffect, useMemo, useCallback } from "react";
import XBRLTaxonomyExplorer from "./XBRLTaxonomyExplorer";
import Loader from "@/components/loader/Loader";
import "@/components/loader/loader.scss";
import {
  TreeNode,
  mapElrGroupedTreeToTreeNodes,
} from "@/components/taxonomy/explorer/tree_utils";
import { TreeLocationTarget } from "./TreeLocationsTab";

type RawTreeNode = {
  qname?: string;
  uuid?: string;
  tree_id?: string;
  name?: string;
    xbrl_type?: string;
  full_type?: string;
  substitution_group?: string;
  children?: RawTreeNode[];
};

type RawElrGroup = {
  elr: string;
  definition?: string;
  numeric_part?: number;
  root_tree?: RawTreeNode[];
};

type PendingNavigation = {
  network: string;
  qname: string;
  uuid?: string;
  treeId?: string;
};

const NAV_LOG_PREFIX = "[TreeLocationNavigation]";

const XBRLTaxonomyExplorerContainer: React.FC = () => {
  // UI state
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<{ [key: string]: boolean }>({});
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const [language, setLanguage] = useState<"en" | "cy">("en");
  const [network, setNetwork] = useState<string>("");

  // Taxonomy selection state
  const [year, setYear] = useState<string | null>(null);
  const [entrypoint, setEntrypoint] = useState<string | null>(null);
  const [entrypoints, setEntrypoints] = useState<{ name: string; href: string }[]>([]);

  // Tree data + loading state
  const [rawTreeData, setRawTreeData] = useState<Record<string, any[]>>({});
  const [entrypointLoaded, setEntrypointLoaded] = useState(false);
  const [loadingEntrypoint, setLoadingEntrypoint] = useState(false);

  // navigation queue (for cross-network jumps)
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);

  const excludedKeys = new Set(["concepts", "dimensions", "hypercubes", "primary_items"]);

  const currentTreeNodes: TreeNode[] = useMemo(() => {
    const raw = rawTreeData?.[network];
    if (!raw || !Array.isArray(raw)) return [];
    return mapElrGroupedTreeToTreeNodes(raw);
  }, [rawTreeData, network]);

  // Warm backend
  useEffect(() => {
    if (entrypointLoaded) {
      fetch("/api/concept-details?qname=core:TurnoverRevenue")
        .then(() => console.log("Backend warmed up"))
        .catch((err) => console.warn("Warm-up failed", err));
    }
  }, [entrypointLoaded]);

  // Fetch entrypoints when year changes
  useEffect(() => {
    if (!year) return;
    fetch(`/api/entrypoints?year=${year}`)
      .then((res) => res.json())
      .then((data) => {
        setEntrypoints(data.entrypoints || []);
      })
      .catch((err) => {
        console.error("Failed to fetch entrypoints", err);
        setEntrypoints([]);
      });
  }, [year]);

  // Load entrypoint and raw trees
  useEffect(() => {
    if (!year || !entrypoint) return;

    setEntrypointLoaded(false);
    setLoadingEntrypoint(true);
    setRawTreeData({});
    setNetwork("");
    setSelectedNode(null);
    setExpandedKeys({});
    setHighlightedKey(null);
    setPendingNavigation(null);

    fetch("/api/load-entrypoint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, href: entrypoint }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status !== "loaded") {
          console.error("Load error:", data.error);
          setLoadingEntrypoint(false);
          return;
        }

        const treeMap: Record<string, any[]> = {};
        for (const [key, rawTree] of Object.entries(data.trees || {})) {
          const normalizedKey = key.replace(/_tree$/, "");
          if (excludedKeys.has(normalizedKey)) continue;
          if (Array.isArray(rawTree)) {
            treeMap[normalizedKey] = rawTree;
          }
        }

        setRawTreeData(treeMap);
        setEntrypointLoaded(true);
        setLoadingEntrypoint(false);
      })
      .catch((err) => {
        console.error("Failed to load entrypoint", err);
        setLoadingEntrypoint(false);
      });
  }, [entrypoint, year]);

  // Default network
  useEffect(() => {
    if (!entrypointLoaded || !Object.keys(rawTreeData).length) return;

    if (!network || !rawTreeData[network]) {
      const preferred = rawTreeData["presentation"] ? "presentation" : Object.keys(rawTreeData)[0];
      if (preferred) setNetwork(preferred);
    }
  }, [rawTreeData, entrypointLoaded, network]);

  const findPathInTreeNodes = useCallback(
    (nodes: TreeNode[], predicate: (node: TreeNode) => boolean): TreeNode[] | null => {
      const dfs = (arr: TreeNode[], acc: TreeNode[]): TreeNode[] | null => {
        for (const node of arr) {
          const next = [...acc, node];
          if (predicate(node)) return next;
          if (node.children?.length) {
            const found = dfs(node.children, next);
            if (found) return found;
          }
        }
        return null;
      };
      return dfs(nodes, []);
    },
    []
  );

  // qname-only jump (existing behavior, used by details/crossref)
  const expandPathToQName = useCallback(
    (targetQName: string) => {
      const path = findPathInTreeNodes(currentTreeNodes, (node) => node.data?.qname === targetQName);
      if (!path) return;

      const expanded: Record<string, boolean> = {};
      for (const node of path) expanded[node.key] = true;
      setExpandedKeys((prev) => ({ ...prev, ...expanded }));

      const target = path[path.length - 1];
      setHighlightedKey(target.key);
      setTimeout(() => setHighlightedKey(null), 5000);
      setSelectedNode(target);
    },
    [currentTreeNodes, findPathInTreeNodes]
  );

  // Build Tree Locations list for currently selected concept
  const treeLocations = useMemo<TreeLocationTarget[]>(() => {
    const qname = selectedNode?.data?.qname;
    if (!qname) return [];

    const results: TreeLocationTarget[] = [];

    const walk = (
  networkKey: string,
  elr: string,
  elrDefinition: string,
  node: RawTreeNode,
  pathNodes: {
    label: string;
    xbrlType?: string;
    fullType?: string;
    substitutionGroup?: string;
  }[],
  numericPart?: number
) => {
  const currentLabel = node.name ?? node.qname ?? "Unnamed";
  const nextPathNodes = [
    ...pathNodes,
    {
      label: currentLabel,
      xbrlType: node.xbrl_type,
      fullType: node.full_type,
      substitutionGroup: node.substitution_group,
    },
  ];

  if (node.qname === qname) {
    results.push({
      network: networkKey,
      elr,
      elrDefinition,
      numericPart,
      qname,
      label: currentLabel,
      uuid: node.uuid,
      treeId: node.tree_id,
      pathNodes: nextPathNodes,
    });
  }

  for (const child of node.children ?? []) {
    walk(networkKey, elr, elrDefinition, child, nextPathNodes, numericPart);
  }
};

    for (const [networkKey, groups] of Object.entries(rawTreeData)) {
      if (!Array.isArray(groups)) continue;
      for (const group of groups as RawElrGroup[]) {
        const elr = group.elr ?? "";
        const elrDefinition = group.definition ?? elr;
        const numericPart = group.numeric_part;
        for (const root of group.root_tree ?? []) {
          walk(networkKey, elr, elrDefinition, root, [], numericPart);
        }
      }
    }

    return results;
  }, [rawTreeData, selectedNode?.data?.qname]);

  // Called from TreeLocationsTab
  const navigateToLocation = useCallback((target: TreeLocationTarget) => {
    console.debug(
      `${NAV_LOG_PREFIX} request`,
      {
        fromNetwork: network,
        toNetwork: target.network,
        qname: target.qname,
        uuid: target.uuid,
        treeId: target.treeId,
        label: target.label,
        elr: target.elr,
      }
    );
    
    setPendingNavigation({
      network: target.network,
      qname: target.qname,
      uuid: target.uuid,
      treeId: target.treeId,
    });

    // switch network if required (do NOT clear selected concept)
    if (network !== target.network) {
      setNetwork(target.network);
      setExpandedKeys({});
      setHighlightedKey(null);
    }
  }, [network]);

  // Execute pending cross-network navigation once the target tree is mounted
  useEffect(() => {
    if (!pendingNavigation) return;
    if (network !== pendingNavigation.network) return;

    // const path =
    //   findPathInTreeNodes(
    //     currentTreeNodes,
    //     (node) =>
    //       (!!pendingNavigation.uuid && node.data?.uuid === pendingNavigation.uuid) ||
    //       (!!pendingNavigation.treeId && node.data?.treeId === pendingNavigation.treeId) ||
    //       node.data?.qname === pendingNavigation.qname
    //   ) ?? null;

    // if (!path) return;
    const treeIdMatches: TreeNode[] = [];
    const uuidMatches: TreeNode[] = [];
    const qnameMatches: TreeNode[] = [];
    const collectMatches = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (pendingNavigation.treeId && node.data?.treeId === pendingNavigation.treeId) {
          treeIdMatches.push(node);
        }
        if (pendingNavigation.uuid && node.data?.uuid === pendingNavigation.uuid) {
          uuidMatches.push(node);
        }
        if (node.data?.qname === pendingNavigation.qname) {
          qnameMatches.push(node);
        }
        if (node.children?.length) collectMatches(node.children);
      }
    };
    collectMatches(currentTreeNodes);

    let matcher: (node: TreeNode) => boolean;
    let matchStrategy: "treeId" | "uuid" | "qname";
    if (pendingNavigation.treeId && treeIdMatches.length > 0) {
  matcher = (node) => node.data?.treeId === pendingNavigation.treeId;
  matchStrategy = "treeId";
} else if (pendingNavigation.uuid && uuidMatches.length > 0) {
  matcher = (node) => node.data?.uuid === pendingNavigation.uuid;
  matchStrategy = "uuid";
} else {
  matcher = (node) => node.data?.qname === pendingNavigation.qname;
  matchStrategy = "qname";
}

    console.debug(`${NAV_LOG_PREFIX} candidates`, {
      network,
      requested: pendingNavigation,
      treeIdMatches: treeIdMatches.length,
      uuidMatches: uuidMatches.length,
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
  }, [pendingNavigation, network, currentTreeNodes, findPathInTreeNodes]);

  return (
    <>
      {loadingEntrypoint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-90 transition-opacity duration-300">
          <Loader />
        </div>
      )}

      <XBRLTaxonomyExplorer
        selectedNode={selectedNode}
        expandedKeys={expandedKeys}
        highlightedKey={highlightedKey}
        language={language}
        network={network}
        year={year}
        entrypoint={entrypoint}
        entrypoints={entrypoints}
        onYearChange={setYear}
        onEntrypointChange={setEntrypoint}
        onSelectNode={setSelectedNode}
        onExpandedKeysChange={setExpandedKeys}
        onLanguageChange={setLanguage}
        onNetworkChange={(val) => {
          if (entrypointLoaded && rawTreeData[val]) {
            setNetwork(val);
            setExpandedKeys({});
            setHighlightedKey(null);
            // note: not clearing selectedNode helps preserve details/tree-locations context
          } else {
            console.warn("[NetworkChange] Ignored invalid or unloaded network:", val);
          }
        }}
        onNavigateToNode={expandPathToQName}
        onNavigateToLocation={navigateToLocation}
        currentTreeNodes={currentTreeNodes}
        entrypointLoaded={entrypointLoaded}
        treeLocations={treeLocations}
      />
    </>
  );
};

export default XBRLTaxonomyExplorerContainer;