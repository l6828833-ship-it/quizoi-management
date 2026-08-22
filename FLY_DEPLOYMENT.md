# Deploy Quizio on Fly.io

## Files Required in GitHub

Commit the project’s `Dockerfile`, `.dockerignore`, `fly.toml`, `app.config.ts`, `package.json`, `server/_core/index.ts`, and `server/_core/oauth.ts` to the GitHub repository that Fly deploys. Fly detects the Dockerfile and uses it instead of trying to infer the Expo runtime. The Fly manifest sets `DEPLOY_TARGET=panel`, so the Node server redirects `/` to `/admin`, serves the dashboard only at `/admin`, and returns `404` for player-facing routes.

## Fly Secrets

Set these in **Fly dashboard → Secrets**. Do not put them in GitHub, `fly.toml`, or Fly build arguments.

| Secret | Required | Purpose |
|---|---:|---|
| `DATABASE_URL` | Yes | Production MySQL connection string for users, quiz content, and imports. |
| `JWT_SECRET` | Yes | Random 32+ character secret used to sign administrator sessions. |
| `OAUTH_SERVER_URL` | Yes for the current sign-in implementation | OAuth server URL used by the Quizio backend. |
| `BUILT_IN_FORGE_API_URL` | Optional | Needed only for the Manus storage proxy. |
| `BUILT_IN_FORGE_API_KEY` | Optional | Companion secret for that optional storage proxy. |

## Fly Build Arguments

Set these in **Fly dashboard → Build arguments** because Expo embeds them into the browser dashboard during image creation. They are configuration values, not secrets.

| Build argument | Required | Purpose |
|---|---:|---|
| `VITE_APP_ID` | Yes for current OAuth | OAuth application identifier. |
| `VITE_OAUTH_PORTAL_URL` | Yes for current OAuth | Browser sign-in portal URL. |
| `OAUTH_SERVER_URL` | Yes for current OAuth | Same OAuth server URL used by the backend. |
| `OWNER_OPEN_ID` | Yes | Your OAuth identifier; this account receives the `admin` role. |
| `OWNER_NAME` | Recommended | Owner display name. |
| `EXPO_PUBLIC_API_BASE_URL` | Leave blank for same-origin hosting | Set only if API uses another HTTPS domain. |

## Fly Public Configuration

The following values are already present in `fly.toml`; they are not secrets. Change `PANEL_PUBLIC_URL` only if you attach a different Fly hostname or custom domain.

| Variable | Value for this Fly app | Purpose |
|---|---|---|
| `DEPLOY_TARGET` | `panel` | Enables the panel-only route policy. |
| `PANEL_PUBLIC_URL` | `https://quizoi-management.fly.dev/admin` | Returns the administrator to the live dashboard after OAuth sign-in. |

## Database and OAuth Preparation

The current Quizio data layer requires **MySQL**. Create or use a managed MySQL database reachable from Fly, set its TLS parameters in `DATABASE_URL` if required, and run the Drizzle migrations once from a trusted machine. The necessary dashboard tables are `users`, `quiz_categories`, `quiz_questions`, and `quiz_imports`.

For the present OAuth implementation, the provider must allow this callback URL:

```text
https://quizoi-management.fly.dev/api/oauth/callback
```

## Verify Deployment

After deployment, open these URLs:

| URL | Expected result |
|---|---|
| `https://quizoi-management.fly.dev/api/health` | JSON containing `ok: true`. |
| `https://quizoi-management.fly.dev/admin` | Private management dashboard sign-in screen. |
| `https://quizoi-management.fly.dev/` | Redirects to the private dashboard. |
| `https://quizoi-management.fly.dev/play` | `404`; player UI is not exposed by this deployment. |

This Fly deployment is **dashboard-only**. It is intentionally not a public Quizio player website and should not be used as the Android player API. Use a separate hosted player API when the mobile application needs remote content delivery. The dashboard and API routes share one hostname here so the administrator session cookie remains same-origin.
