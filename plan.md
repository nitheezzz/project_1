# studywithfun — Email-Verified Accounts and Password Recovery

## Product behavior and implementation

Keep the existing public account screen as the unauthenticated entry point and preserve the delivered dark theme, workspace, legal pages, and account data. Change account creation to a staged email-first flow: collect a unique username, valid email address, and the existing affirmative legal consent; the server creates a short-lived registration challenge and emails a one-time code before collecting any password. Do not create a user row, store a password, or issue an application session before the email is verified. After successful code verification, return a short-lived, single-use registration continuation bound to the challenge. Only then collect and confirm a password; complete registration atomically, hash the password with the existing scrypt implementation, create the verified user, record consent, and start the session. Database uniqueness constraints remain the final authority for usernames and email addresses.

Sign-in requires all three fields: username, email, and password. Normalize username and email on the server; after authenticating the password, require the supplied email to match the account’s verified email. Use the same generic authentication failure for invalid credentials or a mismatching email. Preserve existing verified password accounts and the existing path for legacy accounts whose email still needs verification. No private workspace procedures or session response may admit an account without a password, verified email, and current legal consent.

Add a public forgot-password path. It accepts a username and email, returns the same generic response whether or not they identify an eligible account, and sends a code only to the matching account’s already-verified email. The reset form accepts the code and a new password plus confirmation. Verify and consume the one-time code and update the password hash atomically; increment a per-user session version to invalidate older Daynote JWTs, and do not log the user in automatically. Codes and continuation tokens are generated with cryptographic randomness, stored only as keyed hashes, bound to purpose and challenge identity, short-lived, single-use, and protected by bounded attempts, resend cooldowns, and per-account/IP rate limits. On public signup/reset completion, first check the short-lived one-use continuation using a cheap conditional database lookup; apply a shared, persistent per-IP attempt limit before the expensive password KDF, then keep final challenge consumption and account/password mutation atomic. Invalidate older challenge generations when a new code is issued. Keep provider credentials server-side and fail closed if mail delivery is unavailable.

Persist signup and password-reset challenges in a dedicated `account_challenges` table rather than creating passwordless user accounts or sharing verification state with profile email changes. Add additive Drizzle migrations for challenges, `users.authVersion`, and the hashed-IP completion-attempt table, plus conditional database mutations for challenge issue, attempt increments, verification, consumption, final account creation, password reset, and session invalidation. Continue to use the existing users-table verification fields for legacy-account verification and signed-in email changes. Do not modify notes, tasks, materials, friendships, messages, or existing account records.

## Design decisions

Reuse the delivered studywithfun dark theme, responsive account card, typography, brand mark, and restrained Framer Motion transitions. Add clear, separate signup identity, email-code, password-creation, sign-in, and password-recovery states. Require password confirmation both in the UI and server validation. Use generic recovery copy that does not reveal whether an account exists; show code-send and expiry guidance without exposing code values. Keep existing public legal links and consent behavior.

## Project structure

- `client/src/pages/Home.tsx`: public account screen, staged signup, required-email sign-in, and forgot-password/recovery states.
- `client/src/App.tsx` and `client/public/manus-routes.json`: retain the existing public route declarations; authentication steps remain within the account screen.
- `shared/legal.ts`: current legal version used by registration and session checks.
- `server/routers.ts`: public registration, sign-in, code verification, final registration, recovery, authenticated email changes, and password changes.
- `server/account-security.ts`: normalization, scrypt password hashing, OTP/continuation/IP hashing, cryptographic generation, and bounded throttles.
- `server/email.ts`: server-only Resend delivery for verification and password-recovery messages.
- `server/db.ts`: challenge persistence, shared completion-rate claims, conditional token checks/attempt increments/consumption, and atomic completion operations.
- `drizzle/schema.ts` and generated additive migrations `0008_tranquil_makkari.sql`, `0009_free_garia.sql`, and `0010_slow_firedrake.sql`: challenge table, user session version, and completion-rate table.
- `TODO.md`: explicit acceptance clauses and current evidence.

## Operational dependency

`RESEND_API_KEY` and `RESEND_FROM_EMAIL` have been added to protected project configuration for all environments. Keep their values out of source, logs, and chat. Actual end-user delivery is not verified until the user completes a real signup or password-recovery flow at an address they control. Legal pages remain factual drafts; the service owner must supply legal identity, jurisdiction, and a working privacy contact before they are treated as final public legal terms.
