# studywithfun — ToDo

- [x] **Daily notes and day navigation** — Create, edit, and delete daily notes for study and general planning. Browse notes and tasks by day through a clear daily view and date navigation.
- [x] **PDF study materials in notes** — Add PDF files from the Notes section, associate a PDF with its note, save the PDF in durable storage with its note metadata, and let the signed-in owner reopen/download it later. Files are signature-checked and limited to 8 MB; downloads require authenticated note ownership.
- [x] **Assignable task management** — Create tasks with a title, details, and due date, plus optional study-related context. Assign tasks to a person or owner and clearly display responsibility. Track task progress with to do, in progress, and completed states.
- [x] **Search and filtering** — Search and filter tasks and notes by date, assignment, or completion status.
- [x] **Durable storage** — Reliably store notes, tasks, dates, assignments, and progress in the managed database so the workspace remains available across sessions and devices. The app scopes records to the signed-in account.
- [x] **Private account access** — Provide authenticated username-and-password sign-up and login, require each username to be unique, and keep each account's saved tasks, notes, and Spotify link private to that account.
- [x] **Spotify focus music** — Provide a Spotify link where I can connect my Spotify account and hear music while learning. The app saves a Spotify track, album, or playlist link and plays it using Spotify's embedded player; account login and playback are handled by Spotify.
- [x] **Responsive dark interface** — Provide a dark-theme interface with polished transitions, motion feedback, and accessible, user-friendly controls, optimized for both laptop and mobile screens.

## Verification evidence

- The additive migration applied successfully; all three PDF metadata columns were confirmed with a read-only information-schema query.
- `pnpm check`, `pnpm test` (14 tests), and `pnpm build` pass.
- Preview home, health endpoint, and route manifest return HTTP 200.
- No sample account, note, task, or PDF was added to the shared database/storage during validation.
