# Quizio Content Studio Guide

## Open Content Studio

Open **Settings** in Quizio and select **Content Studio**. Sign in using the project-owner account. Only accounts with the administrator role can add, edit, import, publish, pause, or delete remote quiz content. Player accounts can use the game normally but cannot view management controls.

## Create One Question

Select **New question** from the Question Library. Enter a question prompt, complete all four answer options, and tap the correct option’s radio indicator. Add an explanation, select a category and difficulty, then choose one of the publication states below.

| State | Player visibility | Appropriate use |
|---|---|---|
| Draft | Hidden | A question still being written or reviewed. |
| Published | Available | A finished question that can be served to player quiz modes. |
| Paused | Hidden | A question that should be temporarily removed without deletion. |
| Archived | Hidden | A question intentionally retained only for history. |

After saving, the question appears in the Question Library. You can edit it, publish a draft, pause a published question, or permanently delete it from the quick actions on its card.

## Upload a CSV Batch

In Content Studio, select **Import CSV** and choose a UTF-8 CSV file from your device or paste its rows into the import box. The first row must use this exact header:

```csv
prompt,option_a,option_b,option_c,option_d,correct_option,explanation,category_slug,difficulty,source_note
```

The `correct_option` cell must be `A`, `B`, `C`, or `D`. The `category_slug` must match an existing Quizio category: `geography`, `science`, `history`, `nature`, `arts`, `technology`, `sports`, or `food`. Set `difficulty` to `easy`, `medium`, or `hard`.

Use **Import as drafts** for content that needs review. Use **Validate and publish** only after confirming that the entire CSV is ready for players. Quizio reports the number of imported and rejected rows and shows row-level errors for invalid values or duplicate prompts.

## How Player Quizzes Use Your Content

Published database questions are prioritized whenever a player begins a quiz. If the published library does not yet include enough items to fill a session, Quizio uses the built-in starter bank to complete the round. Paused, archived, and draft questions are never delivered to players.

## Recommended Publishing Workflow

Prepare questions in a spreadsheet, export as UTF-8 CSV, import them as drafts, review each question and its explanation in the Question Library, and publish only the approved entries. This keeps player content accurate while preserving an audit record for every import batch.
