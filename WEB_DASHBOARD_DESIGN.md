# Quizio Browser Dashboard Design

The private dashboard is optimized for browser administration rather than player use. It uses a two-column desktop layout that collapses to a single column on a phone browser. A secure sign-in gate is the only view visible before role verification.

| Dashboard area | Browser behavior |
|---|---|
| Header | Identifies Quizio Content Studio and provides the administrator session state. |
| Overview cards | Shows published, draft, paused, and total question counts. |
| Primary actions | Provides separate **New Question** and **Import CSV** actions above the question library. |
| Question editor | Shows prompt, answer options, correct-answer selector, category, difficulty, publication state, and explanation in a scrollable form. |
| Import workspace | Lets the administrator select or paste a UTF-8 CSV, validates every row, and chooses draft or publish import mode. |
| Question library | Displays content status, category, prompt preview, and concise edit, publish/pause, and delete actions. |

The Android player app does not display any dashboard navigation. Its Settings screen remains focused on player preferences, while the published-question API continues to feed player quiz modes. In a deployed project, the owner opens the dashboard at `/admin` in a normal browser and signs in using the owner account.
