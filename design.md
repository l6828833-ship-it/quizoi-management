# QuizSprint Mobile Interface Design

QuizSprint is an Android-first general-knowledge quiz game designed for fast, one-handed use in a 9:16 portrait layout. The interface follows native mobile conventions: clear hierarchy, large touch targets, a persistent but unobtrusive bottom tab bar, and an uncluttered question screen where answering is the sole task.

## Screen List

| Screen | Primary content and functionality |
|---|---|
| Home | A personal greeting, current XP level and streak, a dominant **Play Now** button, a Daily Quiz callout, and category entry points. |
| Mode selection | Four clear choices: Quick Play, Category Challenge, Daily Quiz, and Streak Mode. Each option states question count and approximate duration. |
| Quiz | Progress, score, timed question prompt, four large answer choices, answer feedback, and an optional teaching explanation. Navigation is intentionally suppressed while an answer is in progress. |
| Result | Final score, accuracy, XP gained, correct-answer count, a short achievement message, and actions to play again, review answers, or return home. |
| Review answers | A vertically scrollable record of questions, selected answer, correct answer, and explanation. |
| Progress | Persisted totals for quizzes played, best score, accuracy, XP level, and streak. |
| Settings | Controls for answer sound/haptics, a reset-local-progress action, and a compact statement of the local-first data approach. |

## Key User Flows

The primary flow is intentionally short: the player opens **Home**, taps **Play Now**, completes a ten-question Quick Play session, receives immediate feedback after each answer, and views a result summary with replay options. Category Challenge follows the same path, but begins by choosing a category. Daily Quiz limits the player to one locally tracked daily completion, while Streak Mode runs five questions and prioritizes consecutive correct answers.

The secondary progress flow is Home → Progress, where the player can see recent performance and current streak. Settings permits personal interaction preferences and deliberate resetting of local data; no cloud account is required in this release.

## Mobile Layout and Interaction Decisions

The visual hierarchy reserves the upper third of each screen for context and progress, the middle for the main task, and the lower third for a reachable primary action. Answer options use full-width stacked cards with a minimum 52-point height, clear option letters, and unambiguous correct/incorrect color feedback. The quiz timer is paired with a textual time value so the state does not rely on color alone. Core actions provide modest pressed-state feedback and haptic confirmation where supported.

## Color Choices

The branded palette uses **Deep Indigo #312E81** for primary actions and navigation, **Vibrant Teal #0F9F9A** for interactive highlights and active progress, and **Warm Amber #F59E0B** for XP, achievement, and daily-quiz emphasis. Neutral surfaces are **Ink #111827**, **Cloud #F8FAFC**, and **Slate #64748B**. Success feedback is **Emerald #16A34A**, while incorrect answers use **Rose #E11D48**. Dark mode retains the indigo and teal identity with deep-charcoal surfaces and high-contrast text.

## Product Boundary for This Release

This build implements the core player app with bundled starter questions and device-local progress. Remote content administration, Firebase, accounts, advertising, privacy consent, and production integrations remain deliberately out of scope until the necessary owner accounts, identifiers, policy material, and production content are supplied.
