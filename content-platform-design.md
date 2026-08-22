# Quizio Content Platform Interface Design

The content platform is an administrator-only area available from Settings as **Content Studio**. It is optimized for portrait use but remains functional in the web preview, where the editor can be used as a compact administration surface. The player-facing quiz experience is not interrupted by content administration controls.

## Screen List

| Screen | Content and functionality |
|---|---|
| Content Studio gate | Explains that published content is managed remotely and provides a secure sign-in action. Non-admin accounts receive a clear access notice without seeing authoring controls. |
| Content dashboard | Shows published, draft, and paused counts, a quick add action, a CSV import action, and a searchable question list. |
| Question editor | Provides inputs for a prompt, four answers, correct answer selection, explanation, category, difficulty, source note, and publication status. |
| CSV import | Lets an administrator paste or select CSV content, previews validation results, and confirms draft or direct-publish import. |
| Category manager | Creates or retires categories and controls their icon, color, and player visibility. |
| Player quiz modes | Reads published remote questions first; retains bundled questions only when the remote pool is unavailable. |

## Key User Flows

The administrator opens Settings, selects **Content Studio**, and signs in. The dashboard loads counts and recent questions. To add a question, the administrator selects **New question**, completes the structured editor, saves a draft, then publishes it when ready. To upload a batch, the administrator chooses **Import CSV**, pastes CSV rows using the displayed header format, reviews accepted and rejected rows, then confirms import. Published rows are available to player quiz modes after the next content refresh.

## Layout and Visual Decisions

The editor uses one full-width field per concept and 52-point minimum input or action targets. Draft state uses muted slate, published state uses emerald, and paused state uses warm amber. Destructive deletion requires a confirmation prompt. The dashboard separates the primary actions at the top from the question list below to support one-handed use and reduce accidental publishing.

## Security Boundary

The interface may hide controls for non-administrators, but every create, edit, import, status change, and delete operation is additionally enforced by server-side administrator authorization. Player queries are public but return only published records.
