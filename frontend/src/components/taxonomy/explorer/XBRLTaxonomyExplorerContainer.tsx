import React, { useState, useEffect, useMemo } from "react";
import XBRLTaxonomyExplorer from "./XBRLTaxonomyExplorer";
import Loader from "@/components/loader/Loader";
import "@/components/loader/loader.scss";
import {
  TreeNode,
  mapElrGroupedTreeToTreeNodes,
} from "@/components/taxonomy/explorer/tree_utils";

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

  // Tree data and loading state
  const [rawTreeData, setRawTreeData] = useState<Record<string, any[]>>({});
  const [entrypointLoaded, setEntrypointLoaded] = useState(false);
  const [loadingEntrypoint, setLoadingEntrypoint] = useState(false);

  const excludedKeys = new Set(["concepts", "dimensions", "hypercubes", "primary_items"]);

  // Memoize current tree nodes to avoid unnecessary recalculations
const currentTreeNodes: TreeNode[] = useMemo(() => {
  const raw = rawTreeData?.[network];
  if (!raw || !Array.isArray(raw)) return [];

  // Both presentation and definition are ELR-grouped
  return mapElrGroupedTreeToTreeNodes(raw);
}, [rawTreeData, network]);

  useEffect(() => {
    console.log("[Debug] Network:", network);
    console.log("[Debug] Available trees:", Object.keys(rawTreeData));
    console.log("[Debug] currentTreeNodes:", currentTreeNodes.length);
  }, [network, rawTreeData, currentTreeNodes]);

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

  // Select default network
  useEffect(() => {
    if (!entrypointLoaded || !Object.keys(rawTreeData).length) return;

    if (!network || !rawTreeData[network]) {
      const preferred = rawTreeData["presentation"]
        ? "presentation"
        : Object.keys(rawTreeData)[0];

      if (preferred) {
        console.log("[AutoSelect] Setting network:", preferred);
        setNetwork(preferred);
      }
    }
  }, [rawTreeData, entrypointLoaded]);

  // Scroll + expand logic
  const expandPathToQName = (targetQName: string) => {
    const keysToExpand: string[] = [];
    let foundNode: TreeNode | null = null;

    const findAndExpand = (nodes: TreeNode[]): boolean => {
      for (const node of nodes) {
        if (node.data?.qname === targetQName) {
          keysToExpand.unshift(node.key);
          foundNode = node;
          return true;
        }
        if (node.children && findAndExpand(node.children)) {
          keysToExpand.unshift(node.key);
          return true;
        }
      }
      return false;
    };

    const found = findAndExpand(currentTreeNodes);
    if (found) {
      const expanded: Record<string, boolean> = {};
      keysToExpand.forEach((k) => (expanded[k] = true));
      setExpandedKeys((prev) => ({ ...prev, ...expanded }));
      const targetKey = keysToExpand[keysToExpand.length - 1];
      setHighlightedKey(targetKey);
      setTimeout(() => setHighlightedKey(null), 5000);
    }
  };

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
            setExpandedKeys({});        // <-- reset expansions
            setSelectedNode(null);      // <-- reset selection
            setHighlightedKey(null);    // <-- reset highlight
          } else {
            console.warn("[NetworkChange] Ignored invalid or unloaded network:", val);
          }
        }}
        onNavigateToNode={expandPathToQName}
        currentTreeNodes={currentTreeNodes}
        entrypointLoaded={entrypointLoaded}
        onEntrypointLoadingChange={setLoadingEntrypoint} // can be removed
      />
    </>
  );
};

export default XBRLTaxonomyExplorerContainer;
