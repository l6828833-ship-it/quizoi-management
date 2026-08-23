# Quizio Management Panel

This package contains the source files for Quizio’s private browser management dashboard. The dashboard is intended to be served at `/admin` and is protected by the server-side administrator authorization checks in `server/routers.ts`.

## Included Source Files

| File | Purpose |
|---|---|
| `content-studio-web.tsx` | Browser dashboard user interface for question creation, CSV import, review, publication, pausing, and deletion. |
| `admin.tsx` | Android-safe route placeholder. It contains no content-management controls. |
| `routers.ts` | Secured tRPC routes for content administration and read-only player delivery. |
| `db.ts` | Database query helpers used by the content platform. |
| `schema.ts` | The category, question, and import-audit data schema. |
| `CONTENT_STUDIO_GUIDE.md` | How to create, import, publish, and manage questions. |
| `WEB_DASHBOARD_ACCESS.md` | Browser dashboard access and Play Store-safe operating boundary. |

Copy these files only into a project that has the matching Expo Router, tRPC, Drizzle, and authentication setup. The files are extracted from the Quizio project checkpoint and are not a standalone application by themselves.
