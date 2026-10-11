# Next phase: reliable mobile beta

Status: local implementation delivered; see BETA_RELEASE.md for evidence and remaining external release gates. Account recovery and live cloud setup were removed from scope by the user. Based on the supplied PRD, especially epics E01–E10 and Phase 5: Hardening and launch.

## Outcome

Move BAGA from a locally validated PWA to a dependable mobile beta. A user should be able to finish or resume setup, record offline, change goals without rewriting past results, recover an optional account, and trust updates and backups.

## Current baseline

Implemented: welcome/profile pages, local diary, goals/check-ins, Lung Studio, insights, cravings, achievements, backup restore, optional account/sync code, reminder functions, installation shortcuts, and mobile navigation. Latest validation: production build, 58 unit/database tests, and 42 browser tests pass. Browser checks use Chromium desktop/mobile configurations; those are not actual iOS/Android device certification.

No public deployment or live Supabase/push configuration has been provisioned. Current automated cloud tests use fixtures. Profile form drafts currently live only in component state. Within-limit history currently applies the user's current limit to earlier days. Password reset is not yet implemented.

## Delivery order

### 1. Finish profile continuity

- Save an unfinished setup draft and current step locally, separately from the completed profile.
- Resume after reload or app closure; offer an explicit restart/discard action.
- Preserve optional name and skipped optional answers. Set completion only after the final consent step and successful write.
- Keep incomplete drafts out of cloud sync and backup exports; remove them on completion or local-data deletion.
- Check keyboard overlap, long names, text scaling, safe areas, landscape, and short phone screens.

Acceptance: closing midway through setup restores the same step and answers; cancelling does not silently create a profile; clearing local data removes the draft; returning users still open their diary directly.

### 2. Preserve goal history

- Introduce versioned goals with effective calendar dates, goal type, limit, and timezone context.
- Use the applicable goal for each day's within-limit results, achievements, and historical comparisons.
- Give goal changes a clear effective-date explanation. Keep smoke-free confirmation based on actual records and check-ins.
- Migrate existing diaries honestly: retain today's known goal, identify earlier goal history as unavailable, and avoid inventing past limits.
- Extend backup schemas, import validation, cloud payload validation, and conflict review before enabling the new model.

Acceptance: changing today's limit leaves earlier results unchanged; backdated cigarette edits recalculate the affected days; overlapping edits on two devices require conflict review; old backups still restore without claiming unknown historical targets.

### 3. Removed from this phase: optional account recovery and live cloud validation

- Add forgotten-password and reset flows, expired-link handling, and clear email-confirmation/resend guidance with throttling.
- Configure a staging Supabase project and HTTPS host using the existing cloud setup guide.
- Validate real email flows, account isolation, offline reconciliation, retry after interrupted requests, conflicts, account deletion, and backup recovery.
- Configure VAPID keys and the scheduler; verify opt-in, quiet hours, revoked permission, expired subscriptions, and delivery on supported devices.
- Keep local-only tracking usable throughout service failures.

Acceptance: account recovery works end to end; signing in alone never uploads records; another account cannot read the diary; closed-app reminders work on supported installed devices and unsupported cases receive accurate guidance.

Dependencies: project/hosting access, email delivery configuration, server secrets, and physical test devices. Prepare code and deployment artifacts before a separate release decision. Never place server secrets in frontend variables or source control.

### 4. Harden installation, updates, accessibility, and performance

- Add automated Firefox and WebKit coverage for critical local flows; keep real-device testing for installation and push.
- Test iPhone Safari/Home Screen and Android Chrome/installed modes: first launch, offline forced-close recovery, keyboard use, back navigation, updates, notification revocation, and restore.
- Verify a service-worker update preserves both persisted records and open unsaved work; document recovery from a broken release.
- Measure the PRD budgets before optimizing. Lazy-load heavier routes if measurements justify it.
- Review screen-reader journeys, focus restoration, contrast, reduced motion, and 200% text scaling.

Acceptance: core logging and restore pass the supported-browser matrix; no mobile overflow or inaccessible primary actions; mobile Lighthouse Performance ≥90 and Accessibility ≥95; core-route JavaScript target ≤200 KB gzip and local-save target ≤100 ms at p95 under documented conditions. Treat p75 LCP ≤2.5 s, INP ≤200 ms, and CLS ≤0.1 as field targets requiring sufficient real usage rather than claims based on a lab run.

### 5. Prepare and run a limited beta

- Verify catalog variants and obtain review of anatomical/health copy and privacy notices before public launch.
- Add secret scanning to existing dependency/security checks.
- Prepare production headers, narrowly scoped staging/preview framing rules, rollback, backup/restore drills, retention/deletion policy, and incident instructions.
- Configure minimal operational alerts and privacy-conscious error reporting that excludes notes, diary records, measurements, identities, and tokens.
- Run a limited beta and prioritize issues involving lost records, blocked access, incorrect history, and mobile discomfort.

Acceptance: P0 acceptance criteria are mapped to evidence; no unresolved critical/high security issues; sensitive-data handling and health copy reviewed; operations and recovery documented; beta blocking defects resolved. A release decision follows review of a concrete deployment candidate.

## Scope boundaries

Defer 3D lungs, clinician imports, native widgets, passkeys, additional reminder categories, and new monetization features. Existing manifest shortcuts are already implemented; verify their supported-device behavior rather than rebuilding them. Discreet app-preview behavior needs platform feasibility assessment and should not be advertised as universally controllable by a PWA.

## Suggested implementation slices

1. Profile draft persistence and mobile resilience.
2. Goal-history model, migration, sync/backup compatibility, and historical UI.
3. Private local app notifications, optional system alerts, quiet hours, and an inbox. Account recovery and live cloud configuration are excluded.
4. Browser/device matrix, performance fixes, release operations, and beta review.

Estimate each slice after its model and dependencies are reviewed. Live-service configuration and external reviews can proceed alongside independent local implementation; they must have evidence before a public-launch claim.
