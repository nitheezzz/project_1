# studywithfun — Verified Email Access Plan

## Product behavior and implementation

Keep the existing public account screen as the unauthenticated entry point. Extend it with email collection, an OTP entry state, and a recovery path for existing password accounts that have no verified email. New registrations require a unique username, email address, and password; the account receives no application session until its email code is successfully verified. Existing unverified accounts can prove password ownership, add an email, and verify it without losing their stored notes, tasks, materials, or friendships. Signed-in users changing their email verify the new address before it replaces the current verified address.

Require both a local password account and `emailVerified` for every application session response and every private tRPC procedure. Keep the login/verification screen public and ensure it exposes no workspace data. Generate short-lived, single-use codes on the server, store only a keyed hash using the platform signing secret, enforce expiry, resend cooldown, and bounded attempts, and never return codes to the client. Persist the per-account OTP send cap and attempt/consume operations in the database; additional IP/login/registration buckets remain process-local best-effort throttles and are not shared across server instances. Deliver mail through a server-only Resend adapter using project-scoped `RESEND_API_KEY` and `RESEND_FROM_EMAIL`; fail closed with a clear configuration error if delivery is unavailable. The platform owner-notification service is not a substitute for end-user mail delivery.

Add public Privacy Policy and Terms & Conditions pages at `/privacy` and `/terms`. Disclose the actual server-readable storage model, categories of information and operational providers, account security controls, retention/deletion limitations, and the lack of end-to-end encryption; do not claim E2EE. Require an unchecked affirmative checkbox agreeing to both documents before new-account creation. For a legacy account or a later legal-version update, require the same consent before sending OTP or issuing a session. Record the accepted legal version and timestamp on the account so private procedures can enforce current consent.

Apply an additive Drizzle migration for email verification, pending-email challenge state, and recorded legal consent. Keep the existing account/session model and cookie compatibility. Update database operations, account security, the account router, the existing account screen, and public page routes; do not alter existing notes, tasks, materials, friends, or their stored records. Keep legal-operator identity, jurisdiction, and privacy contact as explicit items for owner confirmation rather than inventing them.

## Design decisions

Reuse the already-delivered studywithfun dark theme, responsive account card, typography, brand mark, and restrained Framer Motion transitions. Add only the email, code, and consent form states, with clear status and error copy; do not redesign the workspace or introduce decorative assets. The public sign-in and legal pages stay legible and usable on mobile and desktop.

## Project structure

- `client/src/pages/Home.tsx`: public account UI and authenticated workspace switch.
- `client/src/pages/LegalPages.tsx` (new): public Privacy Policy and Terms & Conditions.
- `client/src/App.tsx` and `client/public/manus-routes.json`: declared public legal page routes.
- `shared/legal.ts` (new): shared legal version/effective-date constant used by UI and server.
- `server/routers.ts`: public registration, login, OTP verification, and authenticated email-change procedures; verified-email middleware.
- `server/account-security.ts`: password verification, code creation/checking, and OTP rate limits.
- `server/email.ts` (new): server-only Resend message delivery.
- `server/db.ts`: account lookup and atomic verification-state updates.
- `drizzle/schema.ts` and `drizzle/0005`–`0007` migrations: verification, consent, and persistent send-limit schema.
- `TODO.md`: source-linked acceptance clauses and completion evidence.

## Operational dependency

Real email delivery requires an authorized Resend API key and a sender address/domain verified with Resend. The server adapter uses Resend’s documented `POST https://api.resend.com/emails` contract with a Bearer API key and `from`, `to`, `subject`, and message-body fields ([official documentation](https://resend.com/docs/api-reference/emails/send-email)). Those values belong in protected project configuration, never in source, browser code, or chat. The current project has no configured sender; until the user supplies or authorizes one, the interface and fail-closed verification flow can be implemented but actual delivery and production verification remain blocked. Public legal copy is a factual draft; the service owner must supply legal identity, jurisdiction, and a working privacy contact before representing it as final legal advice or publishing it for production use.
