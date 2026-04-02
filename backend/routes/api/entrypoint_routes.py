import json
import os

from flask import g, jsonify, request

from search.cache import set_search_index
from search.index_builder import build_search_index
from services.search_filters import (
    build_search_filter_options_from_concepts,
    entrypoint_cache_key,
    entrypoint_name_from_href,
)
from services.taxonomy_service import (
    get_entrypoints_for_year,
    load_taxonomy_with_lloyds_fallback,
    safe_close_taxonomy,
)
from state import search_filter_options_cache, taxonomy_cache


def register_entrypoint_routes(app, taxonomy_base_dir: str):
    @app.route("/api/entrypoints", methods=["GET"])
    def list_entrypoints_by_year():
        year = request.args.get("year")
        if not year:
            return jsonify({"error": "Year is required"}), 400

        try:
            entrypoints = get_entrypoints_for_year(taxonomy_base_dir, year)
            return jsonify({"entrypoints": entrypoints})
        except FileNotFoundError as e:
            return jsonify({"error": str(e)}), 404
        except Exception as e:
            return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

    @app.route("/api/load-entrypoint", methods=["POST"])
    def load_entrypoint():
        data = request.get_json()
        year = data.get("year")
        href = data.get("href")

        if not year or not href:
            return jsonify({"error": "Missing year or href"}), 400

        entrypoint_path = href

        try:
            print("\n[load-entrypoint] ===== START =====")
            print(f"[load-entrypoint] year={year}")
            print(f"[load-entrypoint] href={href}")
            print(f"[load-entrypoint] entrypoint_path={entrypoint_path}")
            print(
                f"[load-entrypoint] taxonomy_cache has active? {'active' in taxonomy_cache and taxonomy_cache.get('active') is not None}"
            )

            old_taxonomy = taxonomy_cache.get("active")
            if old_taxonomy is not None:
                print(
                    f"[load-entrypoint] old taxonomy id={id(old_taxonomy)} model_id={id(getattr(old_taxonomy, 'model', None))}"
                )
                try:
                    old_count = len(getattr(old_taxonomy.model, "qnameConcepts", {}))
                except Exception as ex:
                    old_count = f"ERR: {ex}"
                print(f"[load-entrypoint] old qnameConcepts count={old_count}")
                safe_close_taxonomy(old_taxonomy)
                print("[load-entrypoint] old taxonomy controller close requested")

            g.taxonomy = load_taxonomy_with_lloyds_fallback(
                taxonomy_base_dir, year, entrypoint_path
            )
            taxonomy_cache["active"] = g.taxonomy

            print(f"[load-entrypoint] new taxonomy id={id(g.taxonomy)}")
            print(
                f"[load-entrypoint] new model id={id(getattr(g.taxonomy, 'model', None))}"
            )

            try:
                qdict = getattr(g.taxonomy.model, "qnameConcepts", {})
                qcount = len(qdict)
                print(f"[load-entrypoint] new qnameConcepts count={qcount}")

                sample_qnames = [str(qn) for qn in list(qdict.keys())[:10]]
                print(f"[load-entrypoint] sample qnames={sample_qnames}")

                sample_prefixes = sorted(
                    {
                        getattr(qn, "prefix", "")
                        for qn in qdict.keys()
                        if getattr(qn, "prefix", None)
                    }
                )[:30]
                print(f"[load-entrypoint] sample prefixes={sample_prefixes}")
            except Exception as ex:
                print(f"[load-entrypoint] model inspection error: {ex}")

            print("[load-entrypoint] ===== MODEL LOADED =====")

            tree_dir = os.path.join(taxonomy_base_dir, year, "trees")
            if not os.path.isdir(tree_dir):
                return jsonify({"error": f"Tree directory not found: {tree_dir}"}), 404

            entrypoint_name = entrypoint_name_from_href(href)
            print(f"[Flask] Extracted entrypoint_name: {entrypoint_name}")

            tree_files = os.path.join(taxonomy_base_dir, year, "trees", entrypoint_name)
            print(f"[Flask] Looking for tree files in: {tree_files}")

            trees = {}
            for file in os.listdir(tree_files):
                if file.endswith(".json"):
                    with open(os.path.join(tree_files, file), "r", encoding="utf-8") as f:
                        tree_name = file.replace(".json", "")
                        trees[tree_name] = json.load(f)

            print("[Flask] Returning tree keys:", list(trees.keys()))

            concepts_payload = trees.get("concepts", {})
            if isinstance(concepts_payload, dict):
                cache_key = entrypoint_cache_key(year, href)
                search_filter_options_cache[cache_key] = (
                    build_search_filter_options_from_concepts(concepts_payload)
                )
                set_search_index(cache_key, build_search_index(concepts_payload))
                taxonomy_cache["active_search_filter_options_key"] = cache_key
                print(f"[load-entrypoint] cached search filter options key={cache_key}")

            print("[load-entrypoint] ===== END OK =====\n")

            return jsonify(
                {"status": "loaded", "entrypoint": os.path.basename(href), "trees": trees}
            )

        except Exception as e:
            print(f"[load-entrypoint] ERROR: {e}")
            return jsonify({"error": f"Failed to load taxonomy: {str(e)}"}), 500
