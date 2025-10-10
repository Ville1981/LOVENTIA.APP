// File: docs/admin-endpoints.md

// --- REPLACE START: quick doc for new endpoints ---
# Admin API (quick reference)

All routes require:
- Authenticated user (JWT)
- Admin guard: `role === 'admin'` or `isAdmin === true`

## GET `/api/admin/metrics`
Query:
- `since` (ISO, optional) – default 30 days ago

Response:
```json
{
  "since": "2025-09-01T00:00:00.000Z",
  "users": { "total": 1234, "new": 56, "premium": 78 },
  "engagement": { "messages": 987, "likes": 321 }
}
