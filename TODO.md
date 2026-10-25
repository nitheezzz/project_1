# studywithfun — ToDo

- [x] **Daily notes and day navigation** — Create, edit, and delete daily notes for study and general planning. Browse notes and tasks by day through a clear daily view and date navigation. Daily Notes contain no PDF upload or attachment controls.
- [x] **Permanent Study Materials library** — Provide a separate Study Materials layout, independent of daily dates. Let the signed-in owner upload valid PDFs up to 8 MB, save PDF bytes in durable project storage and file metadata in the database, browse saved materials later, reopen/download a saved PDF, and remove a material from the visible library without tying it to a day.
- [x] **Study Materials viewer and layout** — Show the chosen PDF viewer at the top of Study Materials. Keep the saved PDF collection in a section below it and make opening a PDF straightforward.
- [x] **Spotify option fallback** — Spotify’s Embed API does not provide the requested previous/next controls. Remove Spotify playback, controls, setup, and saved-music UI options from the app; leave existing stored preference data untouched.
- [x] **Customizable profile and password** — Let the signed-in user customize their profile and change their account password securely.
- [x] **Task due date, time, and reminders** — Each task has a due date and completion deadline time. Provide a way to enable browser reminders and show a notification popup for unfinished tasks at their deadline while the app is open. Completing a task prevents a later reminder.
- [x] **Remove in-app tips** — Remove the tip/reminder cards from the workspace.
- [x] **Friends search and requests** — Add a Friends workspace where signed-in users can search accounts by username, send friend requests, and accept or decline requests; limit discoverable profiles and request actions to the features needed for account-to-account study interaction.
- [x] **Private friend chat** — Let accepted friends open a private one-to-one conversation and exchange text messages; only the two friends can read or send in that conversation.
- [x] **Assignable task management** — Create tasks with a title, details, and due date, plus optional study-related context. Assign tasks to a person or owner and clearly display responsibility. Track task progress with to do, in progress, and completed states.
- [x] **Search and filtering** — Search and filter tasks and notes by date, assignment, or completion status.
- [x] **Durable storage** — Reliably store notes, tasks, dates, assignments, and progress in the managed database so the workspace remains available across sessions and devices. The app scopes records to the signed-in account.
- [x] **Private account access** — Provide authenticated username-and-password sign-up and login, require each username to be unique, and keep each account's saved tasks, notes, and study materials private to that account.
- [x] **Responsive dark interface** — Provide a dark-theme interface with polished transitions, motion feedback, and accessible, user-friendly controls, optimized for both laptop and mobile screens.

## Verification evidence

- Additive migration `0004_quiet_king_cobra.sql` applied; read-only schema inspection confirmed the profile columns, task deadline-time column, and friend-request, friendship, and direct-message tables.
- `pnpm check` passes; `pnpm test` passes all 14 tests; `pnpm build` succeeds; `git diff --check` is clean.
- Preview root and health endpoint return HTTP 200; `/manus-routes.json` serves the app's route declaration.
- Friends messaging reads and sends are server-authorized only for accepted friendships; Study Materials PDF opening checks the owner's library record before issuing signed URLs.
- Browser reminders require the site to remain open and poll deadlines; system notifications also require browser permission. Unfinished overdue tasks may alert after reopening.
