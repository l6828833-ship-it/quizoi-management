# Quizio Content Platform

## Purpose

The Quizio content platform gives the project owner a protected way to manage quiz questions remotely. The player app will read only **published** questions. Administrators can create an individual question, upload a CSV batch, review validation results, publish or pause questions, and remove questions when they are no longer suitable.

## Data Model

| Entity | Essential fields | Use |
|---|---|---|
| `quiz_categories` | `id`, `name`, `slug`, `iconKey`, `color`, `isActive` | Organizes the player’s category challenges and controls which categories can receive published questions. |
| `quiz_questions` | `id`, `prompt`, four option fields, `correctOptionIndex`, `explanation`, `categoryId`, `difficulty`, `status`, `sourceNote`, `createdBy`, timestamps | Stores a complete, validated multiple-choice question. |
| `quiz_imports` | `id`, `fileName`, `totalRows`, `importedRows`, `rejectedRows`, `errorSummary`, `createdBy`, timestamp | Provides an audit record for every uploaded CSV import. |

## Content States and Access

Only the project owner or an authenticated account carrying the `admin` role can reach content-management mutations. Players can request published questions only. Every new or uploaded item begins as `draft`; an administrator can publish, pause, or archive it. A paused or archived question stays in the database but is never delivered to a player quiz.

## Question Validation

Each question must have a 10–280 character prompt, exactly four non-empty unique options, a correct option index from 0–3, a 10–500 character explanation, a valid category, and a difficulty of `easy`, `medium`, or `hard`. Duplicate normalized prompts are rejected within an upload batch and against existing database content.

## CSV Upload Format

The administration platform accepts a UTF-8 CSV file with this header:

```csv
prompt,option_a,option_b,option_c,option_d,correct_option,explanation,category_slug,difficulty,source_note
```

The `correct_option` value must be one of `A`, `B`, `C`, or `D`. Imported questions are created as drafts unless the administrator deliberately selects **Publish after validation**. The import result reports accepted and rejected rows without exposing unpublished questions to players.

## Player Delivery

The player app requests a filtered pool of published database questions. It uses the locally bundled starter bank only while the database is unavailable or has no published content. This preserves offline play during the initial rollout.
