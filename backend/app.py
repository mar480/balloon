import os
import re
import json
from lxml import etree
from flask import Flask, render_template, send_from_directory, request, jsonify, g
from xbrl.loader import TaxonomyContext

taxonomy_cache = {}

app = Flask(__name__, static_folder='static', template_folder='templates')

TAXONOMY_BASE_DIR = os.path.join(os.path.dirname(__file__), "taxonomies")

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

    if taxonomy is None:
        return jsonify({"error": "No taxonomy loaded"}), 400

    g.taxonomy = taxonomy

    qname = request.args.get("qname", "")
    if ":" not in qname:
        return jsonify({"error": "Invalid qname"}), 400

    prefix, local_name = qname.split(":", 1)

    ns = None
    for qn in g.taxonomy.model.qnameConcepts.keys():
        if getattr(qn, "prefix", None) == prefix:
            ns = qn.namespaceURI
            break

    if ns is None:
        return jsonify({"error": f"Prefix '{prefix}' not found in loaded taxonomy"}), 404

    concept_data = g.taxonomy.concepts.get_concept_json(ns, local_name)
    if not concept_data:
        return jsonify({"error": f"Concept '{qname}' not found"}), 404

    concept_data["concept"]["qname"] = qname
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
        g.taxonomy = TaxonomyContext(entrypoint_path)
        taxonomy_cache["active"] = g.taxonomy

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

        return jsonify({
            "status": "loaded",
            "entrypoint": os.path.basename(href),
            "trees": trees
        })

    except Exception as e:
        return jsonify({"error": f"Failed to load taxonomy: {str(e)}"}), 500

@app.teardown_appcontext
def cleanup(exception=None):
    if hasattr(g, "taxonomy"):
        g.taxonomy.controller.close()

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def catch_all(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return render_template("index.html")

if __name__ == "__main__":
    app.run(debug=True)
