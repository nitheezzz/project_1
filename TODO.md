# studywithfun — ToDo

- [x] **Daily notes and day navigation** — Create, edit, and delete daily notes for study and general planning. Browse notes and tasks by day through a clear daily view and date navigation. Daily Notes contain no PDF upload or attachment controls.
- [x] **Permanent Study Materials library** — Provide a separate Study Materials layout, independent of daily dates. Let the signed-in owner upload valid PDFs up to 8 MB, save PDF bytes in durable project storage and file metadata in the database, browse saved materials later, reopen/download a saved PDF, and remove a material from the visible library without tying it to a day.
- [x] **Spotify option fallback** — Spotify’s Embed API does not provide the requested previous/next controls. Remove Spotify playback, controls, setup, and saved-music UI options from the app; leave existing stored preference data untouched.
- [x] **Assignable task management** — Create tasks with a title, details, and due date, plus optional study-related context. Assign tasks to a person or owner and clearly display responsibility. Track task progress with to do, in progress, and completed states.
- [x] **Search and filtering** — Search and filter tasks and notes by date, assignment, or completion status.
- [x] **Durable storage** — Reliably store notes, tasks, dates, assignments, and progress in the managed database so the workspace remains available across sessions and devices. The app scopes records to the signed-in account.
- [x] **Private account access** — Provide authenticated username-and-password sign-up and login, require each username to be unique, and keep each account's saved tasks, notes, and study materials private to that account.
- [x] **Responsive dark interface** — Provide a dark-theme interface with polished transitions, motion feedback, and accessible, user-friendly controls, optimized for both laptop and mobile screens.

## Verification evidence

- `pnpm check`, all 14 unit tests, `pnpm build`, and `git diff --check` passed.
- The Study Materials schema migration was applied successfully. Existing note PDF references are copied to the date-independent library without dropping note columns or deleting stored objects; this database contained zero legacy note-PDF references to copy.
- Preview home, `/manus-routes.json`, and `/api/health` returned HTTP 200. No sample user data was written for validation.
