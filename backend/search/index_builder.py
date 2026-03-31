import re
from collections import defaultdict

from .types import IndexedConcept, SearchIndex

TOKEN_PATTERN = re.compile(r"[a-z0-9]+")


def _normalize(value: str | None) -> str:
    return (value or "").strip().lower()


def _tokenize(value: str) -> set[str]:
    return set(TOKEN_PATTERN.findall(value))


def _pick_label(entry: dict) -> str:
    labels = entry.get("labels") or []
    for label in labels:
        if not isinstance(label, dict):
            continue
        text = (label.get("label_text") or "").strip()
        if text:
            return text
    return ""


def build_search_index(concepts: dict) -> SearchIndex:
    concepts_by_qname: dict[str, IndexedConcept] = {}
    token_index: dict[str, set[str]] = defaultdict(set)

    for qname, entry in (concepts or {}).items():
        if not isinstance(entry, dict):
            continue

        concept = entry.get("concept") or {}
        local_name = str(concept.get("local_name") or "")
        label = _pick_label(entry)

        indexed = IndexedConcept(
            qname=qname,
            local_name=local_name,
            label=label,
            normalized_qname=_normalize(qname),
            normalized_local_name=_normalize(local_name),
            normalized_label=_normalize(label),
        )
        concepts_by_qname[qname] = indexed

        tokens = (
            _tokenize(indexed.normalized_qname)
            | _tokenize(indexed.normalized_local_name)
            | _tokenize(indexed.normalized_label)
        )

        for token in tokens:
            token_index[token].add(qname)

    return SearchIndex(concepts_by_qname=concepts_by_qname, token_index=dict(token_index))
