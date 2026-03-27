export interface TreeNode {
  key: string;
  label: string;
  data?: {
    qname?: string;
    xbrl_type?: string;
    full_type?: string;
    abstract?: boolean;
    substitution_group?: string;
    label_cy?: string;
    elr?: string;
    definition?: string;
    uuid:string;
    /** unique instance ID to avoid key collisions */
    treeId?: string;
  };
  children?: TreeNode[];
}

type Lang = "en" | "cy";

export const mapElrGroupedTreeToTreeNodes = (
  groups: any[],
  language: Lang = "en"
): TreeNode[] => {
  if (!Array.isArray(groups)) return [];

  const pickConceptLabel = (n: any, lang: Lang) =>
    lang === "cy" ? (n.label_cy ?? n.name ?? "Unnamed Node")
                  : (n.name ?? n.label_cy ?? "Unnamed Node");

  // const mapConcept = (n: any, lang: Lang): TreeNode => ({
  //   key: n.uuid || n.tree_id || n.qname || n.concept_id, // stable > random
  //   label: pickConceptLabel(n, lang),
  //   data: {
  //     qname: n.qname ?? n.concept_id,
  //     xbrl_type: n.xbrl_type,
  //     full_type: n.full_type,
  //     substitution_group: n.substitution_group,
  //     abstract: n.abstract === true,
  //     treeId: n.tree_id,
  //     uuid: n.uuid,
  //   },
  //   children: Array.isArray(n.children) ? n.children.map(c => mapConcept(c, lang)) : [],
  // });

  const mapConcept = (n: any): TreeNode => ({
    key: n.uuid || n.tree_id || n.qname || n.concept_id,
    label: n.name ?? n.label_cy ?? "Unnamed Node", // stable base label
    data: {
      qname: n.qname ?? n.concept_id,
      xbrl_type: n.xbrl_type,
      full_type: n.full_type,
      substitution_group: n.substitution_group,
      abstract: n.abstract === true,
      treeId: n.tree_id,
      uuid: n.uuid,
      label_cy: n.label_cy, // important
    },
    children: Array.isArray(n.children) ? n.children.map((c) => mapConcept(c)) : [],
  });

  return groups.map(g => ({
    key: g.elr,                      // stable key per ELR
    label: g.definition ?? "Unnamed Node",  // ELR header uses definition
    data: { elr: g.elr, definition: g.definition, numeric_part: g.numeric_part, uuid: g.uuid },
    children: Array.isArray(g.root_tree) ? g.root_tree.map((n:any) => mapConcept(n)) : [],
  }));
};


