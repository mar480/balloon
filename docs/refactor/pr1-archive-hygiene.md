# PR 1 — Archive & Repository Hygiene

This phase intentionally avoids feature or behavior changes. It establishes a safe, explicit archive policy and records what is runtime-critical versus archival.

## Objectives

1. Keep runtime paths stable.
2. Preserve legacy material in-place under `archive/` instead of deleting it.
3. Make future cleanup and refactors safer by documenting boundaries.

## Runtime-critical paths (do not archive in PR 1)

- `backend/static/assets/` (active frontend bundle served by Flask)
- `backend/templates/index.html`
- `backend/app.py` and active backend modules under `backend/`
- `frontend/src/` active application code
- `frontend/public/` active web assets

## Archived content in scope

- `archive/frontend/OLDREF/`
  - Legacy frontend reference data that was previously used during exploratory development.
  - Preserved with original folder structure to keep traceability and simplify recovery.

## Verification checks for this phase

Run before/after archive changes:

- Ensure no active imports reference old frontend archive paths.
- Build frontend to verify no missing files from active runtime paths.
- Run a backend syntax smoke check.

Suggested commands:

```bash
rg -n "OLDREF|archive/frontend/OLDREF" frontend/src backend
npm --prefix frontend run build
python -m py_compile backend/app.py
```

## Notes

- Deletion is deferred by design; archival comes first.
- Future PRs can hard-delete files after repeated confirmation they are unused.
