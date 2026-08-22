# Quizio Local Dashboard Operation

## What Can Run Locally

You can run Quizio’s private dashboard on your own computer and open it only in your browser at `http://localhost:8081/admin`. This is suitable for writing questions, importing CSV files, reviewing drafts, and publishing approved content while you are at your computer.

The local dashboard is **not** a public hosting solution. It stops when your computer is off or the local development service is closed. Do not expose a local development address directly to the public internet.

## Recommended Operating Model

| Component | Recommended location | Reason |
|---|---|---|
| Private dashboard | Your computer during content administration | Keeps the management workflow private and under your control. |
| Long-term quiz database | A Supabase project you own | Persists questions, categories, and publishing state independent of the app or your PC. |
| Production player API | A hosted server | Lets every installed Android app retrieve published questions even while your computer is offline. |
| Android player | User device | Reads only approved published questions; it never hosts or edits the dashboard. |

## Local Workflow

Start the project in its folder with `pnpm install` once, then run `pnpm dev`. Open `http://localhost:8081/admin` in the browser on the same computer. For production content, the local server must be configured with your Supabase connection before it can save questions to a Supabase project; the Supabase migration is tracked separately and is not yet active.

## Important Limitation

>A locally hosted dashboard can manage content, but a published Android app cannot depend on your local computer for live quiz delivery.

For the app to work for all players over time, the published player API and production database must remain online. The most practical setup is therefore **local dashboard administration plus a Supabase-owned cloud database and hosted player API**. This gives you private content management without making your computer a public server.
