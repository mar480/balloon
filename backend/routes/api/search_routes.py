from flask import jsonify, request

from search.cache import get_search_index, set_search_index
from search.index_builder import build_search_index
from search.query_engine import search_index
from services.search_filters import (
    build_search_filter_options_from_concepts,
    entrypoint_cache_key,
    load_concepts_json_for_entrypoint,
)
from state import search_filter_options_cache, taxonomy_cache


def register_search_routes(app, taxonomy_base_dir: str):
    @app.route("/api/search-filter-options", methods=["GET"])
    def search_filter_options():
        """
        Returns filter options for advanced search, including:
        - checkbox options
        - referenceSources
        - referenceParagraphsBySource
        """
        year = request.args.get("year")
        href = request.args.get("href")

        if year and href:
            cache_key = entrypoint_cache_key(year, href)
        else:
            cache_key = taxonomy_cache.get("active_search_filter_options_key")

        if not cache_key:
            return (
                jsonify({"error": "No active entrypoint context. Provide year and href."}),
                400,
            )

        cached = search_filter_options_cache.get(cache_key)
        if cached is not None:
            return jsonify(cached)

        if not (year and href):
            return jsonify({"error": "Cache miss and year/href not provided."}), 404

        concepts_payload = load_concepts_json_for_entrypoint(taxonomy_base_dir, year, href)
        if not concepts_payload:
            return (
                jsonify({"error": "concepts.json not found or empty for entrypoint"}),
                404,
            )

        payload = build_search_filter_options_from_concepts(concepts_payload)
        search_filter_options_cache[cache_key] = payload
        taxonomy_cache["active_search_filter_options_key"] = cache_key
        return jsonify(payload)

    @app.route("/api/search-concepts", methods=["POST"])
    def search_concepts():
        data = request.get_json() or {}
        year = data.get("year")
        href = data.get("href")
        q = (data.get("q") or "").strip()
        filters = data.get("filters") or {}

        try:
            limit = int(data.get("limit", 25))
        except (TypeError, ValueError):
            return jsonify({"error": "limit must be an integer"}), 400

        try:
            offset = int(data.get("offset", 0))
        except (TypeError, ValueError):
            return jsonify({"error": "offset must be an integer"}), 400

        if not year or not href:
            return jsonify({"error": "Missing year or href"}), 400
        if not isinstance(filters, dict):
            return jsonify({"error": "filters must be an object"}), 400

        if limit < 1 or limit > 100:
            return jsonify({"error": "limit must be between 1 and 100"}), 400
        if offset < 0:
            return jsonify({"error": "offset must be >= 0"}), 400

        cache_key = entrypoint_cache_key(year, href)
        index = get_search_index(cache_key)

        if index is None:
            concepts_payload = load_concepts_json_for_entrypoint(taxonomy_base_dir, year, href)
            if not concepts_payload:
                return (
                    jsonify({"error": "concepts.json not found or empty for entrypoint"}),
                    404,
                )
            index = build_search_index(concepts_payload)
            set_search_index(cache_key, index)

        payload = search_index(
            index=index,
            query=q,
            limit=limit,
            offset=offset,
            filters=filters,
        )

        top_scores = [
            {
                "qname": item.get("qname"),
                "score": item.get("score"),
                "matched_fields": item.get("matched_fields"),
                "score_breakdown": item.get("score_breakdown"),
            }
            for item in (payload.get("results") or [])[:10]
        ]
        print(
            f"[search-concepts] year={year} href={href} q='{q}' "
            f"offset={offset} limit={limit} total={payload.get('total')}"
        )
        print(f"[search-concepts] top_scores={top_scores}")

        return jsonify(payload)
