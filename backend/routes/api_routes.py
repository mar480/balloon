from routes.api.concepts_routes import register_concept_routes
from routes.api.entrypoint_routes import register_entrypoint_routes
from routes.api.lifecycle_routes import register_lifecycle_routes
from routes.api.search_routes import register_search_routes


def register_api_routes(app, taxonomy_base_dir: str):
    register_concept_routes(app)
    register_entrypoint_routes(app, taxonomy_base_dir)
    register_search_routes(app, taxonomy_base_dir)
    register_lifecycle_routes(app)
