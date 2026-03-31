import re

from .types import SearchIndex, SearchResponse, SearchResult

TOKEN_PATTERN = re.compile(r"[a-z0-9]+")


def _tokenize(value: str) -> list[str]:
    return TOKEN_PATTERN.findall((value or "").strip().lower())


def _score_match(normalized_query: str, q_tokens: list[str], concept) -> tuple[int, list[str]]:
    score = 0
    matched_fields: list[str] = []

    field_values = [
        ("qname", concept.normalized_qname),
        ("local_name", concept.normalized_local_name),
        ("label", concept.normalized_label),
    ]

    for field_name, field_value in field_values:
        if not field_value:
            continue

        field_score = 0
        if normalized_query and normalized_query in field_value:
            field_score += 4

        matched_tokens = [token for token in q_tokens if token and token in field_value]
        if matched_tokens:
            field_score += len(set(matched_tokens))

        if field_score > 0:
            score += field_score
            matched_fields.append(field_name)

    return score, matched_fields


def search_index(index: SearchIndex, query: str, limit: int, offset: int) -> SearchResponse:
    normalized_query = (query or "").strip().lower()
    q_tokens = _tokenize(normalized_query)

    if normalized_query:
        candidate_qnames = set()
        for token in q_tokens:
            candidate_qnames.update(index.token_index.get(token, set()))
        if not candidate_qnames:
            candidate_qnames = set(index.concepts_by_qname.keys())
    else:
        candidate_qnames = set(index.concepts_by_qname.keys())

    scored: list[tuple[int, str, SearchResult]] = []

    for qname in candidate_qnames:
        concept = index.concepts_by_qname.get(qname)
        if concept is None:
            continue

        score, matched_fields = _score_match(normalized_query, q_tokens, concept)
        if normalized_query and score <= 0:
            continue

        result: SearchResult = {
            "qname": concept.qname,
            "label": concept.label,
            "local_name": concept.local_name,
            "score": score,
            "matched_fields": matched_fields,
        }
        scored.append((score, concept.qname, result))

    scored.sort(key=lambda item: (-item[0], item[1]))

    total = len(scored)
    paged = [item[2] for item in scored[offset : offset + limit]]

    return {
        "results": paged,
        "total": total,
        "limit": limit,
        "offset": offset,
    }
