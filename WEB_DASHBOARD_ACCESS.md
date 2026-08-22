# Quizio Browser Dashboard Access

## Use the Browser Dashboard

After publishing Quizio, open the project’s web address in a browser and append `/admin`. For example, if the web address is `https://quiz.example.com`, the private administration page is `https://quiz.example.com/admin`.

Sign in with the project-owner account. The server verifies the administrator role before it permits any dashboard action. Do not share the owner account with quiz players or writers who should not be able to publish content.

## Upload and Publish Questions

The dashboard can create individual questions or import a UTF-8 CSV file. Every imported row is validated for a complete prompt, four unique answer options, a valid correct-answer letter, explanation, category, and difficulty. Import as drafts for review, then publish approved questions. Published questions become available to the Android player app through the existing MySQL-backed API.

## Android App Boundary

The Android player app does not include a link to the dashboard, a CSV picker, content editor, or publishing action. It only reads published questions and can safely continue with the bundled starter bank when the remote library is unavailable or too small for a full quiz session.

## Database Choice

Use the project’s managed MySQL database for this workflow. It already contains the category, question, and import-audit tables used by the dashboard and avoids storing Supabase or other external-service credentials in the Android app. If you later require a separate organization-owned platform, a Supabase migration can be planned independently without changing the player content rules.
