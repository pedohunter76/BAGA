# Optional accounts, sync, and reminders

BAGA’s local diary needs no credentials or backend. The next phase is implemented in the app and the migrations/functions in `supabase/`, but no hosted Supabase project or push sender has been connected in this workspace.

## Connect accounts and synchronization

1. Create or select a Supabase project. Apply `supabase/migrations/001_private_sync.sql`, then `002_push_reminders.sql`, then `003_goal_history.sql` using its SQL editor or your migration runner. Apply each migration once. Existing deployments must apply migration 003 before syncing updated goal-history preferences. These create private records, retry receipts, push subscriptions, RLS, and authenticated RPCs.
2. Enable email/password authentication. Keep email confirmation enabled, configure your HTTPS site URL and redirect allowlist, and configure email delivery. BAGA’s registration form asks users to confirm their email and then sign in. Configure the project’s password policy to require at least 12 characters. Passwords are sent only to Supabase Auth and never stored in IndexedDB.
3. Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your project URL and **public anon/publishable key**. The app rejects service-role/secret keys. `VITE_` variables are included in the browser bundle; never put private credentials there.
4. Run `npm run build` and deploy `dist/` to your HTTPS host. These variables are read at build time; restart development or rebuild after changing them. The CSP permits connections to hosted `*.supabase.co` projects. Self-hosted/custom-domain Supabase requires an explicit CSP/configuration adjustment.
5. Open Account & sync, sign in, review the upload explanation, and explicitly enable cloud sync. Signing in alone never uploads the diary. Link a second fresh browser profile to the same account to download records. If both profiles already have different preferences or edited records, review their conflicts.

Authentication tokens are held in memory and sessionStorage for the browser tab; passwords are not persisted. A restored browser session can restore sessionStorage, so sign out explicitly on shared devices. Local data is not app-encrypted.

## Synchronization behavior

User records save in IndexedDB first. Pending changes are derived from durable acknowledged baselines; upload operations and UUID idempotency keys are persisted before requests. A failed request retains its operation for retry, including when the server committed but its response was lost. Automatic sync runs while an authenticated, opted-in BAGA tab is open, after local edits, every minute, and when connectivity returns. Closed-app background sync is not promised.

The transport uses Supabase’s versioned REST interface: paginated reads from `/rest/v1/baga_records` and mutation batches through `/rest/v1/rpc/baga_sync_batch`. Every account’s server writes are serialized, payloads are validated, and expected revisions prevent silent overwrites. Batches are capped at 50 operations and 512 KB. A per-account limit of 2,000 new operations per minute limits bursts; idempotent retries remain available. Large imports resume on later sync runs if throttled.

Changes on both devices become conflicts. Both versions stay local for explicit review, including deletion conflicts. Edits made during an upload remain queued for the next run. All tables are covered: logs, check-ins, measurements, preferences/goals, custom brands, and cravings. Physical removal of a previously synced record creates a cloud tombstone. Deletion markers and retry receipts are retained until account deletion; there is no automatic destructive tombstone pruning.

A local diary stays bound to its original account after sign-out. Switching accounts requires exporting and clearing local data first. Pausing uploads and signing out do not delete cloud records. “Clear local data” affects this device. “Delete cloud account” deletes the Supabase Auth identity, records, receipts, and push subscriptions; the local diary remains available. Do not invoke administrative user deletion from the browser with a service-role key.

## Configure optional Web Push

1. Generate a VAPID key pair using a trusted Web Push utility, for example `web-push generate-vapid-keys`. Put only its public key in `VITE_WEB_PUSH_PUBLIC_KEY`, then rebuild. Keep the matching private key in Supabase function secrets.
2. Set function secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (a valid `mailto:` contact or HTTPS URL), `BAGA_APP_ORIGIN` (the exact deployed HTTPS origin), and a long random `BAGA_CRON_SECRET`. The hosted platform supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to functions. These private values never belong in the frontend or source control.
3. Deploy `push-subscription` and `reminder-dispatch` with the provided `supabase/config.toml`. The subscription handler validates each bearer token with Supabase Auth and restricts CORS to `BAGA_APP_ORIGIN`. The dispatcher validates the scheduler secret; it is not a user-facing endpoint.
4. Configure a trusted scheduler to POST once per minute to `https://YOUR-PROJECT.supabase.co/functions/v1/reminder-dispatch`, with `X-Baga-Cron-Secret` set to the secret. Store that secret in your scheduler’s secret store, such as Supabase Vault; do not paste it into a public cron URL or committed SQL. No scheduler is created automatically.
5. In an installed/production BAGA browser, sign in and select daily check-in and/or Sunday review reminders, delivery time, and quiet hours. Permission is requested only after pressing Enable. iOS/iPadOS requires supported Home Screen installation. Development mode has no service worker, so it gives a production/install explanation before requesting permission.

Subscriptions accept only HTTPS endpoints on known Google, Mozilla, Apple, or Windows push-service domains. Other providers need an explicit allowlist update. At most 20 category subscriptions per account are accepted (normally ten devices with two categories). The dispatcher leases up to 100 due reminders, processes ten at a time, retries failures, and removes expired subscriptions on 404/410. It skips quiet hours and reminders older than one hour rather than sending an old nudge at an unwanted time. Daylight-saving gaps skip to the next valid occurrence. Weekly reviews use local Sundays.

Push is best effort and can be delayed by browsers/providers. Delivery can be retried after a sender crash; a stable notification tag replaces duplicate notifications. The payload carries a category only. The worker displays fixed, neutral copy and always opens a same-origin app view. No cigarette counts, measurements, notes, or identities enter lock-screen messages or dispatcher logs. Update the saved schedule after changing timezone. Disable this device’s reminders or revoke browser permission to stop them; cloud account deletion removes their server subscriptions.

## Validate and deploy

```sh
npm test
npm run build
npm run test:e2e -- --workers=2
npm run check:push
npm audit
npm run audit:push
```

The tests execute the migration SQL in an embedded PostgreSQL engine, exercise RLS/authorization and idempotency, and use intercepted cloud endpoints for two-browser offline/conflict flows. `audit:push` audits exact npm versions from the Deno lock using npm’s registry/TLS settings. `check:push` type-checks the actual Deno function entry points. The browser fixture build uses public dummy configuration and never contacts a real project; do not deploy `dist-cloud-test/`.

This does not certify a live Supabase deployment or actual-device push delivery. Verify those against your configured project and supported iOS/Android devices before public release. The development/preview origins have separate diaries from the deployed origin. Production `_headers` denies framing; local Vite preview allows embedding so the cloud preview panel can display the app. For a deployed embedded app, replace production framing rules with an explicit allowlist of your trusted parent origins.
