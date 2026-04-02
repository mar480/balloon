from flask import g, jsonify, request

from state import taxonomy_cache


def register_concept_routes(app):
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
            concept_ns=concept_ns, concept_name=local_name
        )

        return jsonify({"hypercubes": results})

    @app.route("/api/concept-details")
    def concept_details():
        taxonomy = getattr(g, "taxonomy", taxonomy_cache.get("active"))

        print("\n[concept-details] ===== START =====")
        print(f"[concept-details] requested qname={request.args.get('qname', '')}")
        print(f"[concept-details] g has taxonomy? {hasattr(g, 'taxonomy')}")
        print(
            f"[concept-details] cache has active? {'active' in taxonomy_cache and taxonomy_cache.get('active') is not None}"
        )

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

            available_prefixes = sorted(
                {
                    getattr(qn, "prefix", "")
                    for qn in qdict.keys()
                    if getattr(qn, "prefix", None)
                }
            )
            print(
                f"[concept-details] available prefixes (sample): {available_prefixes[:50]}"
            )
        except Exception as ex:
            print(f"[concept-details] model inspection error: {ex}")
            available_prefixes = []

        qname = request.args.get("qname", "")
        if ":" not in qname:
            print("[concept-details] invalid qname format")
            return jsonify({"error": "Invalid qname"}), 400

        prefix, local_name = qname.split(":", 1)
        print(f"[concept-details] requested prefix={prefix}, local_name={local_name}")

        ns = None
        for qn in g.taxonomy.model.qnameConcepts.keys():
            if getattr(qn, "prefix", None) == prefix:
                ns = qn.namespaceURI
                break

        print(f"[concept-details] resolved namespace={ns}")

        if ns is None:
            print("[concept-details] namespace resolution failed")
            return (
                jsonify(
                    {
                        "error": f"Prefix '{prefix}' not found in loaded taxonomy",
                        "available_prefixes": available_prefixes[:50],
                    }
                ),
                404,
            )

        concept_data = g.taxonomy.concepts.get_concept_json(ns, local_name)
        if not concept_data:
            print("[concept-details] concept_data not found")
            return jsonify({"error": f"Concept '{qname}' not found"}), 404

        concept_data["concept"]["qname"] = qname
        print("[concept-details] ===== END OK =====\n")
        return jsonify(concept_data)
