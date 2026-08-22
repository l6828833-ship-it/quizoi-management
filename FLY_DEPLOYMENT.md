# Deploy Quizio Content Studio on Fly.io

## Scope

This repository deploys **only** Quizio’s private browser dashboard. The player game is not exposed: `/` redirects to `/admin`, and player-facing paths return `404`.

## Required repository files

Keep `Dockerfile`, `.dockerignore`, `fly.toml`, `package.json`, `pnpm-lock.yaml`, `metro.config.js`, `app/admin.tsx`, `components/content-studio-web.tsx`, `lib/supabase.ts`, and `supabase/migrations/20260822_quizio_content_studio.sql` in the GitHub branch that Fly builds.

## Supabase browser build arguments

Set these in **Fly dashboard → Build arguments**. They are embedded in the browser bundle, so only use the Supabase publishable key—not a secret or service-role key.

| Build argument | Value |
|---|---|
| `SUPABASE_URL` | `https://anjnjbiixzbwcmqritxj.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | The active `sb_publishable_…` key from Supabase → Project Settings → API Keys. |
| `QUIZIO_OWNER_EMAIL` | `aymenlasfar4@icloud.com` |
| `EXPO_PUBLIC_API_BASE_URL` | Leave blank for this same-origin panel deployment. |

## Owner sign-in

The dashboard uses **Supabase Auth email/password**. After the Fly image is rebuilt with the arguments above:

1. Open `https://quizoi-management.fly.dev/admin`.
2. Select **Create owner account**.
3. Use exactly `aymenlasfar4@icloud.com` and choose a long private password.
4. If Supabase asks for email confirmation, confirm the email before signing in.

The Supabase `quizio_admins` allow-list and Row Level Security policies permit this account—and no other account—to create, import, edit, publish, pause, or remove quiz content.

## Supabase dashboard setting

In Supabase → Authentication → URL Configuration, set the Site URL to:

```text
https://quizoi-management.fly.dev
```

Add the same domain to the allowed redirect URLs. This ensures account-confirmation links return to the deployed panel.

## Legacy variables

The Supabase dashboard no longer needs `DATABASE_URL`, `OAUTH_SERVER_URL`, `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, `OWNER_OPEN_ID`, or `OWNER_NAME`. Those values may be removed after the Supabase panel is verified. Keep `JWT_SECRET` only if you continue using legacy Express API routes.

## Verify deployment

| URL | Expected result |
|---|---|
| `https://quizoi-management.fly.dev/admin` | Supabase owner email/password screen or the signed-in question library. |
| `https://quizoi-management.fly.dev/` | Redirects to `/admin`. |
| `https://quizoi-management.fly.dev/play` | `404`; the player remains unavailable on this deployment. |
| `https://quizoi-management.fly.dev/api/health` | JSON health response. |

