# Archive

This folder stores project data and assets intentionally removed from active runtime paths.

## Current contents

- `frontend/OLDREF/`: legacy frontend reference taxonomy data moved out of active frontend runtime locations during refactor PR 1 for safety and cleanliness.

## Policy

- Items are moved here instead of being deleted when runtime usage is uncertain.
- Archived material should preserve original relative structure wherever possible for traceability.
- Future cleanup can hard-delete archived items once repeatedly confirmed unused.

## PR 1 runtime boundary notes

The following active runtime paths are intentionally **not** archived in PR 1:

- `backend/static/assets/` (Flask-served frontend build assets)
- `backend/templates/index.html`
- Active backend modules under `backend/`
- Active frontend app code in `frontend/src/` and public assets in `frontend/public/`
