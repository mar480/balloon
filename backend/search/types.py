from dataclasses import dataclass
from typing import List, TypedDict


class SearchRequest(TypedDict):
    year: str
    href: str
    q: str
    limit: int
    offset: int


class SearchResult(TypedDict):
    qname: str
    label: str
    local_name: str
    score: int
    matched_fields: List[str]


class SearchResponse(TypedDict):
    results: List[SearchResult]
    total: int
    limit: int
    offset: int


@dataclass(frozen=True)
class IndexedConcept:
    qname: str
    local_name: str
    label: str
    normalized_qname: str
    normalized_local_name: str
    normalized_label: str


@dataclass(frozen=True)
class SearchIndex:
    concepts_by_qname: dict[str, IndexedConcept]
    token_index: dict[str, set[str]]
