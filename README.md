# BAGA

**Your lungs. Your habits. Your progress.**

A mobile-first, offline-first cigarette diary with optional cloud continuity based on the supplied October 2026 PRD. React, TypeScript, Vite, Dexie/IndexedDB, Zod, Radix Dialog, and Workbox. Fonts, icons, and the lung illustration are bundled locally; the app sends no analytics. Personal records are uploaded only after explicit cloud-sync consent.

## Run

Requires Node.js 22.12+ (validated with Node 24) and npm.

```sh
cd /workspace/BAGA
npm ci --cache /workspace/.cache/npm
npm run dev
```

For an installable offline build:

```sh
npm run build
npm run preview -- --port 4173
```

The service worker is enabled in the production build. Visit the app online once before relying on offline navigation. Production hosting requires HTTPS. Development mode intentionally has no service worker to avoid stale code during editing.

## Implemented

- First-visit welcome page and full-page, three-step profile creation with an initials preview, adult confirmation, privacy explanation, optional name, goals, favorite brand, and per-stick/per-pack prices. Setup drafts resume after reload, with explicit discard and renewed consent. Returning users open their saved diary directly.
- One-tap logging, detailed records with quantity, backdated timestamps, trigger, mood, location, and notes; editing, deletion, and undo.
- Durable IndexedDB writes before success feedback. UUIDs, original price snapshots, revisions, tombstones, and stale-edit protection across tabs.
- Asia/Manila default with configurable timezone, daily overview, spending, recent activity, and configurable overview cards.
- Smoke-free, within-limit, and check-in streaks; confirmed zero-cigarette days; daily limits, weekly reduction comparison targets, tracking-only mode, and quit-date milestones.
- Calendar with historical check-ins, brand/variant summaries, 7/30/365-day statistics, spending charts, and trigger breakdowns.
- Searchable proposed Philippine brand catalog and custom entries. Catalog variants remain unverified retail seed data, clearly identified in the UI.
- Interactive 2D lung anatomy, separate illustrative intensity and animation preferences, manually recorded Volume/FVC/FEV1 values with source/date/units, user-selected numeric comparisons, and a recorded-exposure timeline.
- Dark/light themes, reduced-motion support, accessible dialogs, keyboard navigation, and screen-reader chart descriptions. Mobile layouts use readable text, 16px form inputs, large touch controls, safe-area spacing, bottom-sheet dialogs, and a bottom navigation with an accessible menu for every page.
- Private app notification inbox, daily/Sunday reminders, new milestone alerts, quiet hours, read status, a test action, and explicit system-notification permission. Delivery receipts prevent repeats across tabs/reloads. Local reminders run while BAGA is open; scheduled alerts after closure require the separately configured optional push service.
- PWA manifest, regular/maskable PNG icons, Android/desktop install prompt where supported, iOS manual instructions, offline app shell, and a nonblocking update prompt.
- CSV/JSON export and validated JSON restore, with preview, safe merge, atomic rollback on conflicts, and explicit confirmation before replacing a diary.
- Private craving journal with intensity, triggers, context, coping actions, outcomes, edit/delete/undo, and offline persistence. Cravings never add cigarette records.
- Derived achievements for confirmed check-ins, smoke-free days, and meeting chosen limits; hourly patterns and baseline spending comparisons using completed days.
- Optional email/password account, explicit sync consent, durable pending operations, retries, revision conflicts, and cross-device recovery. Supabase migrations enforce user ownership and server-side validation.
- Optional scheduled daily/Sunday Web Push, quiet hours, discreet lock-screen copy, browser unsubscribe, and authenticated subscription/dispatcher functions. Backend/project/scheduler configuration is required.
- Persistent-storage request, explicit local-data deletion, and cloud account deletion that cascades uploaded records and subscriptions. Local-only diagnostics export contains only allowlisted error codes and timestamps; it never includes diary data or sends telemetry.
- Lazy-loaded tracking pages, JavaScript budget checks, source secret-pattern checks, update protection for open/edited forms, and an HTTP health endpoint. Cross-browser tests are configured separately for Firefox and WebKit.

## Data and medical boundaries

By default, no backend is connected and no login is needed. Optional account, synchronization, and push code is implemented; configure your own Supabase project to enable it using [the cloud setup guide](docs/CLOUD_SETUP.md). No live project or push sender has been provisioned here. Records live in IndexedDB and are **not encrypted by this application**. Export private backups regularly. JSON exports include user tables without auth tokens or sync credentials; CSV contains active cigarette records. JSON restore validates every record before an atomic import. No telemetry or monitoring service is configured.

The lung drawing never depicts actual lung health. Illustration percentages never modify measurements. Capacity comparisons use entered values and user-selected references, without clinical interpretation. Recorded pack-year equivalents cover only logged cigarettes, not lifetime exposure or disease risk. No smoking brand is presented as safer. Basic anatomical copy still requires professional review before public launch.

Streaks require completed daily check-ins, including zero-cigarette days. Missing days never establish abstinence. Current-day streaks count only after check-in, and backdated logs recalculate results. Within-limit history uses date-effective goal versions, including each version’s timezone. New versions start today; a westward timezone change cannot move a new goal into an earlier saved date. Existing diaries start goal history on migration day, and older backups retain unknown earlier limits. Goal history also controls achievements, historical chart flags, and baseline comparisons. Same-day goal edits replace that day’s version; earlier days remain unchanged. Check-ins stay attached to their confirmed calendar dates when timezone changes, while cigarette records regroup by timestamp. Weekly averages use completed days rather than assuming untracked days are zero.

## Validate

```sh
npm test
npm run build
npm run check:budgets
npm run check:secrets
npm run test:e2e -- --workers=2
npm audit
npm run audit:push
npm run check:push
```

The end-to-end suite starts a production preview automatically. It uses `/usr/bin/chromium` in this cloud environment; elsewhere, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to a Chromium executable. Tests cover desktop/mobile, real service-worker offline reloads, durable logs, price snapshots, edit/delete/undo, check-ins, measured-value separation, export/deletion, layout, persistence failures, embedded previews, offline cravings, backup restore, two-profile cloud sync, conflict review, and automated accessibility. SQL tests run the actual migrations in embedded PostgreSQL.

Recreate install icons with `node scripts/generate-icons.mjs`. Generated PNGs are committed assets and do not need rebuilding during ordinary installation.

## Deployment and remaining PRD work

Deploy `dist/` on an HTTPS static host with navigation fallback to `index.html`. `public/_headers` supplies CSP, HSTS, permissions, framing, referrer, and cache policies for hosts that support that format. Other hosts must apply equivalent response headers themselves. Vite preview applies CSP and privacy headers for local validation and permits embedding in the preview panel; production headers retain framing protection. Vite preview is not a production server.

The mobile beta phase adds resumable setup, goal history, private app notifications, update protection, performance checks, diagnostics, and release operations. Account recovery and live cloud provisioning were excluded from this phase by request. Existing optional cloud code remains available; see [cloud setup](docs/CLOUD_SETUP.md) for configuration and the new goal-history migration. See [beta release evidence and runbook](docs/BETA_RELEASE.md) for verified checks, actual-device test steps, health checks, and rollback. Public deployment, physical-device certification, catalog verification, and medical/privacy review remain pending.

Firefox/WebKit local-flow coverage is available with `npx playwright install --with-deps firefox webkit` followed by `npm run test:cross-browser`. Browser downloads were blocked by this workspace’s network policy; CI is configured to run these tests where the browsers can be installed.

This cloud task already has an isolated checkout. Use `/workspace/BAGA` directly; do not create another Git worktree unless requested.
