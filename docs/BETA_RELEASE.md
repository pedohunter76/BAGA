# Mobile beta evidence and operations

## Scope and current status

Delivered locally: resumable/discardable setup drafts with renewed adult confirmation; versioned goals with timezone-aware historical results; private app notification inbox, daily/Sunday/milestone categories, quiet hours and read status; explicit optional system alerts; service-worker update guards; lazy-loaded pages; privacy-filtered local diagnostics export; secret-pattern and JavaScript-budget checks; cross-browser CI configuration.

The user excluded account recovery and live cloud provisioning. No public site, account-recovery service, notification scheduler, external monitoring vendor, or real-device beta has been provisioned. Existing optional cloud code is preserved. Its schema extension is migration `003_goal_history.sql`.

Local app notifications work without an account. Receipts and preferences stay on this device and are excluded from sync/backups. Reminders are evaluated while an app tab is active, at the selected time or within one hour afterward, outside quiet hours. Daily reminders skip confirmed days. Sunday reminders follow the profile timezone. Milestones that were already unlocked when notifications were enabled do not produce retroactive nudges. System alerts require explicit permission and a ready production service worker; revocation retains the inbox fallback. A PWA cannot reliably schedule local system alerts while closed.

Setup drafts are separate from the completed profile and never establish consent. Completion, restoration of an onboarded profile, and local-data deletion remove the draft. Drafts and diagnostics are not uploaded or included in diary backups.

Goal history is retained in preferences so existing sync conflicts show both versions. Prior goals survive later changes; older unknown limits are not guessed. Existing version-2 diaries start their history on upgrade day. Legacy backups remain readable. Within-limit streaks, milestones, daily chart flags, calendar flags, and baseline comparisons use known date-effective goals. Same-day edits replace that day's goal. A timezone shift cannot move a new goal into an earlier saved date. Goal history currently supports up to 1,000 versions per diary and has explicit storage/server validation.

## Automated release checks

Run from the repository root:

```sh
npm ci
npm run check:secrets
npm test
npm run build
npm run check:budgets
npm run test:e2e -- --workers=2
npm run check:push
npm audit --audit-level=high
npm run audit:push
npx playwright install --with-deps firefox webkit
npm run test:cross-browser -- --workers=2
```

The secret-pattern guard reports locations without printing matching values. It is a limited source-control safeguard, not a complete security audit. The budget check conservatively totals all built JavaScript gzip assets, including deferred routes, against the PRD's 200 KiB core-route target.

Chromium browser tests cover real IndexedDB persistence, offline reloads, profile drafts, notification denial/inbox/read state, duplicate delivery prevention, goal-history changes and backup restore, embedded preview, and a waiting service-worker update with an open entry. SQL tests execute all migrations and validate nested goal history. Privacy tests ensure exported diagnostics contain only allowed event codes and timestamps, even if stored entries have extra fields.

Firefox and WebKit downloads received HTTP 403 “Domain forbidden” in this workspace. Their tests are configured in `playwright.cross-browser.config.ts` and CI but are not locally certified. Mobile browser emulation is not physical-device certification. Lab performance reports are not evidence of field p75 Core Web Vitals.

## Local validation results

| Check                                           | Result                                               |
| ----------------------------------------------- | ---------------------------------------------------- |
| Production TypeScript/Vite/PWA build            | Passed                                               |
| Unit/database tests                             | 77 passed                                            |
| Desktop/mobile Chromium browser tests           | 52 passed                                            |
| Frontend and push dependency audits             | 0 vulnerabilities                                    |
| Source secret-pattern guard                     | Passed                                               |
| All JavaScript assets, including deferred pages | 187.0 KiB gzip                                       |
| Mobile Lighthouse welcome route                 | Performance 92, Accessibility 100, Best Practices 96 |
| Lighthouse simulated mobile LCP / CLS           | 2.8 s / 0.088                                        |
| Local save sample                               | p95 13.5 ms; median 4.8 ms                           |

The local-save sample used the actual IndexedDB/Zod save API in development Chromium: 50 measured writes after five warmups, in this workspace. These timings do not certify slower physical devices. Lighthouse used simulated mobile throttling against a fresh production preview. Its lab LCP is above the 2.5 s field target; real-user p75 LCP/INP remains unmeasured. The detailed Lighthouse report is saved locally at `.cache/lighthouse-mobile.json`. No public-launch performance certification is claimed.

## Physical-device beta checklist

Use supported iPhone Safari plus Home Screen mode, and Android Chrome plus installed mode. Also test desktop Chrome, Firefox, and Safari where available.

- Start with a fresh profile, interrupt setup, resume, discard, and finish with fresh consent.
- Test 320px equivalent width, large accessibility text, landscape, keyboard opening, long names, safe areas, and one-handed logging.
- Visit once online, install, force-close, switch offline, reopen, record/edit/check in, and restore a backup.
- Change a goal and verify earlier results; change timezone across midnight without inventing earlier goals.
- Enable app notifications, deny/revoke system permission, verify the inbox and quiet hours, and open each notification destination.
- Confirm no local-only promise of scheduled alerts after closure. Verify optional hosted push separately only if later configured.
- Load an update with an entry open: keep the entry, save it, then update. Verify the saved record and profile after reload.
- Use VoiceOver/TalkBack for profile, diary, notification settings, inbox, and backup confirmation.

Record device, OS/browser version, installation mode, release artifact, and pass/failure evidence. Do not record private diary values in shared reports.

## Deployment and rollback

1. Preserve an immutable known-good `dist/` artifact and the complete validation report before publishing a candidate.
2. Use an HTTPS static host with navigation fallback and equivalent policies from `public/_headers`. Keep HTML/service workers revalidated; keep hashed assets immutable. Preview embedding rules must allow only the intended preview parents; production framing protection remains enabled.
3. Retain earlier hashed assets while old clients and service workers may reference them. Do not delete an old asset directory immediately after publishing.
4. Poll `/health.txt` on the deployed origin with caching disabled and expect HTTP 200 plus `baga-ready`. Separately probe `/`, the current JavaScript asset, `/sw.js`, and `/manifest.webmanifest`; a static health file alone does not prove diary functionality. Configure alerts with the hosting/monitoring provider when hosting is selected.
5. Before release, perform an export/import drill using a synthetic diary and verify counts, snapshots, goals, and completed-day results. Keep private backups under user control; never put them in source control or public hosting.
6. If access, offline saves, or upgrades regress, restore the entire known-good artifact and its headers, preserving old assets. Do not delete IndexedDB to recover a deployment. Test the rollback with existing profiles and installed/offline clients; a service worker may delay its adoption until connectivity and an update are available.
7. Export device diagnostics only when the user chooses. Reports contain error codes and timestamps, no exception messages, URLs, tokens, identities, notes, or health measurements. There is no automatic telemetry destination.

The IndexedDB version-3 upgrade adds device-local tables and goal history. Rolling back to older code that opens only database version 2 may fail; use a rollback build that retains version-3 database compatibility while reverting the faulty UI/behavior. Validate that candidate before deploying it.

## External public-launch gates

Catalog retail verification, professional health-copy review, privacy/retention/vendor review, physical-device results, real-host header verification, configured operational alerts, and a reviewed rollback candidate remain required before declaring a public launch. These need evidence and resources outside local code changes. Any future cloud setup must apply the new migration before syncing goal-history payloads.
