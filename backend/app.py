import os
import re
import json
from lxml import etree
from flask import Flask, render_template, send_from_directory, request, jsonify, g
from xbrl.loader import TaxonomyContext
from urllib.parse import urlparse, unquote

taxonomy_cache = {}

app = Flask(__name__, static_folder='static', template_folder='templates')

TAXONOMY_BASE_DIR = os.path.join(os.path.dirname(__file__), "taxonomies")

def _is_lloyds_year_key(year: str) -> bool:
    return isinstance(year, str) and year.lower().startswith("lloyds")

def _is_http_href(href: str) -> bool:
    return isinstance(href, str) and href.startswith(("http://", "https://"))

def _find_local_entrypoint_from_href(year: str, href: str) -> str:
    """
    Resolve a remote entrypoint URL to a local file inside backend/taxonomies/<year>.
    Strategy:
      1) filename exact match
      2) URL path suffix match
    """
    year_root = os.path.join(TAXONOMY_BASE_DIR, year)
    if not os.path.isdir(year_root):
        raise FileNotFoundError(f"Year root not found: {year_root}")

    parsed = urlparse(href)
    remote_path = unquote(parsed.path).lstrip("/")  # e.g. lloyds/2025-.../lloyds-2025-...xsd
    base_name = os.path.basename(remote_path)

    file_paths = []
    for root, _, files in os.walk(year_root):
        for f in files:
            file_paths.append(os.path.join(root, f))

    # 1) Exact filename matches
    name_matches = [p for p in file_paths if os.path.basename(p) == base_name]
    if len(name_matches) == 1:
        return name_matches[0]
    if len(name_matches) > 1:
        name_matches.sort(key=lambda p: (len(p.split(os.sep)), len(p)))
        return name_matches[0]

    # 2) Path suffix match
    remote_suffix = remote_path.replace("\\", "/")
    suffix_matches = [p for p in file_paths if p.replace("\\", "/").endswith(remote_suffix)]
    if len(suffix_matches) == 1:
        return suffix_matches[0]
    if len(suffix_matches) > 1:
        suffix_matches.sort(key=lambda p: (len(p.split(os.sep)), len(p)))
        return suffix_matches[0]

    raise FileNotFoundError(
        f"Could not map href to local file for year='{year}': {href}"
    )

def _safe_close_taxonomy(taxonomy_obj):
    if taxonomy_obj is None:
        return
    try:
        taxonomy_obj.controller.close()
    except Exception:
        pass

def _load_taxonomy_with_lloyds_fallback(year: str, href: str):
    """
    Primary: load href as-is.
    Fallback (Lloyds only): if remote load appears empty/forbidden, resolve local file and reload.
    """
    print(f"[taxonomy-load] Attempt primary load: {href}")
    primary = TaxonomyContext(href)
    primary_count = len(getattr(primary.model, "qnameConcepts", {}))
    print(f"[taxonomy-load] Primary qnameConcepts count={primary_count}")

    # Apply fallback only for Lloyds-style keys and only for remote hrefs with empty model
    if _is_lloyds_year_key(year) and _is_http_href(href) and primary_count == 0:
        print("[taxonomy-load] Lloyds fallback triggered (empty model after remote load)")
        _safe_close_taxonomy(primary)

        local_entrypoint = _find_local_entrypoint_from_href(year, href)
        print(f"[taxonomy-load] Local fallback entrypoint: {local_entrypoint}")

        fallback = TaxonomyContext(local_entrypoint)
        fallback_count = len(getattr(fallback.model, "qnameConcepts", {}))
        print(f"[taxonomy-load] Fallback qnameConcepts count={fallback_count}")

        if fallback_count == 0:
            _safe_close_taxonomy(fallback)
            raise RuntimeError(
                f"Local fallback loaded but model still empty for {local_entrypoint}"
            )

        return fallback

    # Not fallback case, or primary load succeeded
    if primary_count == 0:
        print("[taxonomy-load] Warning: model empty after primary load (fallback not applied)")
    return primary

def get_entrypoints_for_year(year: str):
    package_path = os.path.join(TAXONOMY_BASE_DIR, year, "META-INF", "taxonomyPackage.xml")
    if not os.path.exists(package_path):
        raise FileNotFoundError(f"taxonomyPackage.xml not found for year {year}")
    
    ns = {"tp": "http://xbrl.org/2016/taxonomy-package"}
    tree = etree.parse(package_path)
    entrypoints = tree.xpath("//tp:entryPoint", namespaces=ns)
    result = []
    for ep in entrypoints:
        name = ep.findtext("tp:name", namespaces=ns)
        ep_doc = ep.find("tp:entryPointDocument", namespaces=ns)
        href = ep_doc.get("href") if ep_doc is not None else ""
        if name and href:
            result.append({"name": name, "href": href})
    return result

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/assets/<path:filename>")
def serve_assets(filename):
    return send_from_directory(os.path.join(app.static_folder, 'assets'), filename)

@app.route("/api/hello", methods=["POST"])
def get_hypercubes():
    taxonomy = getattr(g, "taxonomy", taxonomy_cache.get("active"))

    if taxonomy is None:
        return jsonify({"error": "No taxonomy loaded"}), 400

    g.taxonomy = taxonomy

    data = request.get_json()
    qname = data.get("qname", "")
    if not qname or ":" not in qname:
        return jsonify({"error": "Invalid qname"}), 400

    ns_prefix, local_name = qname.split(":", 1)
    concept_ns = g.taxonomy.model.prefixedNamespaces.get(ns_prefix)

    results = g.taxonomy.hypercubes.find_hypercubes_for_concept(
        concept_ns=concept_ns,
        concept_name=local_name
    )

    return jsonify({"hypercubes": results})

@app.route("/api/concept-details")
def concept_details():
    taxonomy = getattr(g, "taxonomy", taxonomy_cache.get("active"))

    print("\n[concept-details] ===== START =====")
    print(f"[concept-details] requested qname={request.args.get('qname', '')}")
    print(f"[concept-details] g has taxonomy? {hasattr(g, 'taxonomy')}")
    print(f"[concept-details] cache has active? {'active' in taxonomy_cache and taxonomy_cache.get('active') is not None}")

    if taxonomy is None:
        print("[concept-details] taxonomy is None")
        return jsonify({"error": "No taxonomy loaded"}), 400

    g.taxonomy = taxonomy

    print(f"[concept-details] taxonomy id={id(g.taxonomy)}")
    print(f"[concept-details] model id={id(getattr(g.taxonomy, 'model', None))}")

    try:
        qdict = getattr(g.taxonomy.model, "qnameConcepts", {})
        qcount = len(qdict)
        print(f"[concept-details] qnameConcepts count={qcount}")

        sample_qnames = [str(qn) for qn in list(qdict.keys())[:10]]
        print(f"[concept-details] sample qnames={sample_qnames}")

        available_prefixes = sorted({
            getattr(qn, "prefix", "")
            for qn in qdict.keys()
            if getattr(qn, "prefix", None)
        })
        print(f"[concept-details] available prefixes (sample): {available_prefixes[:50]}")
    except Exception as ex:
        print(f"[concept-details] model inspection error: {ex}")
        available_prefixes = []

    qname = request.args.get("qname", "")
    if ":" not in qname:
        print("[concept-details] invalid qname format")
        return jsonify({"error": "Invalid qname"}), 400

    prefix, local_name = qname.split(":", 1)
    print(f"[concept-details] requested prefix={prefix}, local_name={local_name}")

    # Keep your existing resolution logic for now, just with logs around it:
    ns = None
    for qn in g.taxonomy.model.qnameConcepts.keys():
        if getattr(qn, "prefix", None) == prefix:
            ns = qn.namespaceURI
            break

    print(f"[concept-details] resolved namespace={ns}")

    if ns is None:
        print("[concept-details] namespace resolution failed")
        return jsonify({
            "error": f"Prefix '{prefix}' not found in loaded taxonomy",
            "available_prefixes": available_prefixes[:50]
        }), 404

    concept_data = g.taxonomy.concepts.get_concept_json(ns, local_name)
    if not concept_data:
        print("[concept-details] concept_data not found")
        return jsonify({"error": f"Concept '{qname}' not found"}), 404

    concept_data["concept"]["qname"] = qname
    print("[concept-details] ===== END OK =====\n")
    return jsonify(concept_data)

@app.route("/api/entrypoints", methods=["GET"])
def list_entrypoints_by_year():
    year = request.args.get("year")
    if not year:
        return jsonify({"error": "Year is required"}), 400

    try:
        entrypoints = get_entrypoints_for_year(year)
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
        print(f"[load-entrypoint] taxonomy_cache has active? {'active' in taxonomy_cache and taxonomy_cache.get('active') is not None}")

        old_taxonomy = taxonomy_cache.get("active")
        if old_taxonomy is not None:
            _safe_close_taxonomy(old_taxonomy)
            print(f"[load-entrypoint] old taxonomy id={id(old_taxonomy)} model_id={id(getattr(old_taxonomy, 'model', None))}")
            try:
                old_count = len(getattr(old_taxonomy.model, "qnameConcepts", {}))
            except Exception as ex:
                old_count = f"ERR: {ex}"
            print(f"[load-entrypoint] old qnameConcepts count={old_count}")
            # close old taxonomy before replace
            try:
                old_taxonomy.controller.close()
                print("[load-entrypoint] old taxonomy controller closed")
            except Exception as ex:
                print(f"[load-entrypoint] old taxonomy close error: {ex}")

        # g.taxonomy = TaxonomyContext(entrypoint_path)
        g.taxonomy = _load_taxonomy_with_lloyds_fallback(year, entrypoint_path)
        taxonomy_cache["active"] = g.taxonomy

        print(f"[load-entrypoint] new taxonomy id={id(g.taxonomy)}")
        print(f"[load-entrypoint] new model id={id(getattr(g.taxonomy, 'model', None))}")

        try:
            qdict = getattr(g.taxonomy.model, "qnameConcepts", {})
            qcount = len(qdict)
            print(f"[load-entrypoint] new qnameConcepts count={qcount}")

            sample_qnames = [str(qn) for qn in list(qdict.keys())[:10]]
            print(f"[load-entrypoint] sample qnames={sample_qnames}")

            sample_prefixes = sorted({
                getattr(qn, "prefix", "")
                for qn in qdict.keys()
                if getattr(qn, "prefix", None)
            })[:30]
            print(f"[load-entrypoint] sample prefixes={sample_prefixes}")
        except Exception as ex:
            print(f"[load-entrypoint] model inspection error: {ex}")

        print("[load-entrypoint] ===== MODEL LOADED =====")

        # --- keep your existing tree_dir/tree loading code below unchanged ---
        tree_dir = os.path.join(TAXONOMY_BASE_DIR, year, "trees")
        if not os.path.isdir(tree_dir):
            return jsonify({"error": f"Tree directory not found: {tree_dir}"}), 404

        raw_entrypoint_name = os.path.splitext(os.path.basename(href))[0]
        entrypoint_name = re.split(r"[-_]\d{4}-\d{2}-\d{2}", raw_entrypoint_name)[0]
        print(f"[Flask] Extracted entrypoint_name: {entrypoint_name}")

        tree_files = os.path.join(TAXONOMY_BASE_DIR, year, "trees", entrypoint_name)
        print(f"[Flask] Looking for tree files in: {tree_files}")

        trees = {}
        for file in os.listdir(tree_files):
            if file.endswith(".json"):
                with open(os.path.join(tree_files, file), "r", encoding="utf-8") as f:
                    tree_name = file.replace(".json", "")
                    trees[tree_name] = json.load(f)

        print("[Flask] Returning tree keys:", list(trees.keys()))
        print("[load-entrypoint] ===== END OK =====\n")

        return jsonify({
            "status": "loaded",
            "entrypoint": os.path.basename(href),
            "trees": trees
        })

    except Exception as e:
        print(f"[load-entrypoint] ERROR: {e}")
        return jsonify({"error": f"Failed to load taxonomy: {str(e)}"}), 500


@app.teardown_appcontext
def cleanup(exception=None):
    taxonomy = getattr(g, "taxonomy", None)
    active = taxonomy_cache.get("active")

    print("\n[teardown] ===== START =====")
    print(f"[teardown] exception={exception}")
    print(f"[teardown] g has taxonomy? {taxonomy is not None}")
    print(f"[teardown] active exists? {active is not None}")

    if taxonomy is not None and taxonomy is not active:
        _safe_close_taxonomy(taxonomy)
   
    if taxonomy is not None:
        print(f"[teardown] g.taxonomy id={id(taxonomy)} model_id={id(getattr(taxonomy, 'model', None))}")
        try:
            count = len(getattr(taxonomy.model, "qnameConcepts", {}))
        except Exception as ex:
            count = f"ERR: {ex}"
        print(f"[teardown] g.taxonomy qnameConcepts count={count}")

    if active is not None:
        print(f"[teardown] active taxonomy id={id(active)} model_id={id(getattr(active, 'model', None))}")
        try:
            count = len(getattr(active.model, "qnameConcepts", {}))
        except Exception as ex:
            count = f"ERR: {ex}"
        print(f"[teardown] active qnameConcepts count={count}")

    # TEMP: do not close anything while diagnosing
    print("[teardown] TEMP no-close mode enabled")
    print("[teardown] ===== END =====\n")

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def catch_all(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return render_template("index.html")

if __name__ == "__main__":
    app.run(debug=True)
