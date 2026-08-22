# Quizio Browser Dashboard Architecture

## Recommended Database

Quizio uses the project’s existing managed **MySQL** database for categories, quiz questions, and CSV import audit records. This avoids embedding third-party keys in the Android app and avoids the additional account, policy, and migration work that a Supabase integration would require. The server alone holds database access; the Android player receives only published question data through the protected application API.

## Play Store-Safe Boundary

| Surface | Purpose | Content permissions |
|---|---|---|
| Android player app | Play quizzes and download published questions | Read-only access to published questions; no question file selection, authoring, or administrative navigation. |
| Private browser dashboard at `/admin` | Create, import, review, publish, pause, and delete questions | Requires administrator sign-in and server-side role verification for every management operation. |
| Application server | Validates requests and communicates with MySQL | Enforces the administrator role for every write operation and exposes only published records to player reads. |

The dashboard is delivered as a web-specific route. The Android route shows only a neutral message and contains no editor, CSV picker, import action, or question-management interface. This maintains a clear separation between the consumer player experience and private content operations.

## Deployment Model

After publishing the project, the administrator opens `https://<your-deployment-domain>/admin` in a desktop or mobile browser. The administrator signs in with the project-owner account, then uploads a CSV or enters individual questions. The player app continues to request published questions through the same server, with the bundled question bank available only as a continuity fallback.

## Why Supabase Is Not Required Here

Supabase can be used if you later need its hosted dashboard, realtime subscriptions, or a separate database project. For the current Quizio workflow, managed MySQL already supports the required relational data, server-side authorization, CSV audit records, and Play Store-safe read-only player delivery without introducing another external credential boundary.
