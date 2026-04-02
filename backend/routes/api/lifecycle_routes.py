from flask import g

from services.taxonomy_service import safe_close_taxonomy
from state import taxonomy_cache


def register_lifecycle_routes(app):
    @app.teardown_appcontext
    def cleanup(exception=None):
        taxonomy = getattr(g, "taxonomy", None)
        active = taxonomy_cache.get("active")

        print("\n[teardown] ===== START =====")
        print(f"[teardown] exception={exception}")
        print(f"[teardown] g has taxonomy? {taxonomy is not None}")
        print(f"[teardown] active exists? {active is not None}")

        if taxonomy is not None and taxonomy is not active:
            safe_close_taxonomy(taxonomy)

        if taxonomy is not None:
            print(
                f"[teardown] g.taxonomy id={id(taxonomy)} model_id={id(getattr(taxonomy, 'model', None))}"
            )
            try:
                count = len(getattr(taxonomy.model, "qnameConcepts", {}))
            except Exception as ex:
                count = f"ERR: {ex}"
            print(f"[teardown] g.taxonomy qnameConcepts count={count}")

        if active is not None:
            print(
                f"[teardown] active taxonomy id={id(active)} model_id={id(getattr(active, 'model', None))}"
            )
            try:
                count = len(getattr(active.model, "qnameConcepts", {}))
            except Exception as ex:
                count = f"ERR: {ex}"
            print(f"[teardown] active qnameConcepts count={count}")

        # TEMP: do not close anything while diagnosing
        print("[teardown] TEMP no-close mode enabled")
        print("[teardown] ===== END =====\n")
