# Product Requirements Document (PRD)

Version 1.0 · October 2026 · Progressive Web App · Philippines-first

# BAGA

Your Lungs. Your Habits. Your Progress.

Product concept: A mobile-first cigarette tracking and lung visualization PWA that allows users to record every cigarette they smoke, select Philippine cigarette brands, monitor smoking patterns, customize a simulated lung-capacity indicator, track smoke-free streaks, and understand how their habits change over time.

The app should feel like a polished daily-use health and lifestyle tracker, not a basic cigarette counter.

Product direction

Proposed MVP

Cigarette tracker

Brand-specific daily logging

Lung simulator

Interactive capacity visualization

Streak system

Smoke-free and reduction goals

Insights

Trends, spending, and patterns

## 1. Product overview and objectives

### 1.1 Executive summary

BAGA is a Progressive Web App designed primarily for adult smokers in the Philippines who want to understand and monitor their cigarette consumption.

Unlike conventional habit trackers, BAGA combines three distinct experiences: a localized cigarette diary, an interactive lung visualization, and a goal-oriented streak tracker.

The application will support cigarette brands and variants commonly sold in the Philippines, with editable prices and pack sizes. Users can track cigarettes per day, spending in Philippine pesos, smoking frequency, and personal reduction or cessation goals.

Medical accuracy requirement: The lung simulator is an educational visualization, not a medical diagnostic tool. Cigarette counts cannot reliably determine an individual's lung capacity, lung damage percentage, or disease risk. The app must clearly distinguish user-entered or measured lung-capacity values from illustrative animations.

### 1.2 Target audience

| Audience                        | Primary needs                                                     |
| ------------------------------- | ----------------------------------------------------------------- |
| Adult daily smokers             | Monitor daily cigarette consumption and spending                  |
| Occasional/social smokers       | Understand patterns and triggers                                  |
| Adults reducing consumption     | Set limits and compare progress                                   |
| Adults trying to quit           | Track abstinence, cravings, and milestones                        |
| Health-conscious former smokers | Review historical smoking records and maintain smoke-free streaks |

The product is designed for adults aged 18 and above. It should not encourage smoking, rank brands by desirability, or reward increased cigarette consumption.

### 1.3 Product objectives

1. Make logging a cigarette possible in under three seconds after onboarding.
2. Provide a useful, customizable lung visualization without presenting fictional medical measurements as facts.
3. Support consistent daily tracking and achievable reduction or cessation goals.
4. Provide locally relevant Philippine cigarette information, prices, and currency.
5. Work offline after installation and synchronize records safely when connectivity returns.
6. Make the app engaging through insights, thoughtful animations, personalization, and progress indicators rather than guilt-based messaging.

### 1.4 Proposed success metrics

| KPI                                  | Initial target                   |
| ------------------------------------ | -------------------------------- |
| Onboarding completion                | ≥70%                             |
| First cigarette log completion       | ≥80% of onboarded active smokers |
| Median logging time                  | Under 3 seconds                  |
| Day-7 retention                      | ≥30%                             |
| Day-30 retention                     | ≥15%                             |
| Eligible PWA installation conversion | ≥20%                             |
| Offline log synchronization success  | ≥99%                             |
| Crash-free sessions                  | ≥99.5%                           |

These are proposed launch targets, not established industry benchmarks. They should be reviewed after collecting baseline usage data.

### 1.5 Product scope

MVP (P0): Onboarding, cigarette logging, Philippine brand catalog, customizable lung indicator, daily/weekly statistics, cigarette limits, smoke-free streaks, offline persistence, local reminders, privacy settings, and PWA installation.

Phase 2 (P1): Cloud synchronization, optional account, craving journal, achievement system, advanced analytics, widgets or shortcuts, and data export.

Future (P2): Clinician-compatible spirometry data imports, optional integration with supported health platforms, and personalized educational content reviewed by qualified health professionals.

## 2. Core product features and functional specifications

### 2.1 Main dashboard

The dashboard should be the first screen displayed when users open the installed PWA.

BAGA / TODAY

# Your daily overview

CIGARETTES TODAY

Demo

# 6

/ 10 daily limit

4 remaining before your chosen limit

## 3 days

Within-limit streak

## ₱72

Today's spending

Lung visualization

Illustrative

Visual representation only — not a clinical lung scan

Log cigarette

Home

Log

Lungs

Insights

Conceptual dashboard specification with illustrative sample values; not a functioning application screen.

Feature: Daily overview

User story: As a smoker, I want to open the app and immediately understand how many cigarettes I have smoked today, my current limit, and how much I have spent.

Acceptance criteria:

- Today's cigarette count updates immediately after a log is saved.
- A progress bar displays the count relative to the user's chosen daily limit.
- Spending uses PHP currency formatting.
- Users can configure dashboard cards.
- The dashboard remains functional without internet connectivity.
- All statistics use the user's configured timezone, defaulting to Asia/Manila.

### 2.2 Philippine cigarette brand and variant tracker

This is a major differentiating feature of BAGA.

The app should provide a searchable, locally relevant cigarette catalog rather than forcing users to manually enter brands every time.

Proposed Philippine catalog entries

| Brand         | Example variants to support                      |
| ------------- | ------------------------------------------------ |
| Marlboro      | Red, Gold, Black, Ice Blast                      |
| Fortune       | Red, Blue, other verified variants               |
| Mighty        | Verified locally available variants              |
| Winston       | Red, Blue, other verified variants               |
| Camel         | Verified locally available variants              |
| Philip Morris | Verified locally available variants              |
| Hope          | Verified locally available variants              |
| Custom brand  | User-created name, variant, price, and pack size |

The catalog is a proposed seed list, not a verified current inventory of Philippine retail products. Actual brand variants should be confirmed before release.

Feature: Cigarette logging

User story: As a user, I want to log a cigarette with my preferred brand and variant in as few taps as possible.

Required inputs:

- Brand and variant
- Quantity, defaulting to one
- Date and time, defaulting to now
- Price per stick or per pack
- Optional mood, trigger, location category, and notes
- Optional tags such as after meal, stress, socializing, coffee, or boredom

Acceptance criteria:

- A favorite cigarette can be logged with one primary action from the dashboard.
- Each log is assigned a unique ID and timestamp.
- Users can backdate, edit, and delete records.
- The app supports mixed brands within the same day.
- No cigarette log is lost if the user closes the app immediately after a successful local save.
- Users can undo an accidental log.

Feature: Brand-specific statistics

The application should display cigarette counts and spending by brand, variant, day, week, and month. Brand rankings are strictly consumption summaries, not endorsements or quality rankings.

### 2.3 Interactive lung simulator and capacity indicator

This should be BAGA's signature visual feature.

[Lung Transplantation — Pulmonary & Critical Care Fellowship Program](https://images.openai.com/static-rsc-4/Vv-JyPKBKiJCzbCzRoVENVUOk83uYyGdMYZ9dSWZEmEJAm4ntyrFR0_Ni3R8b8k0A9TCJ6HCUZ_OlvAD9eYsjcxa-crF2-vq6jEFb5kC9m1u0KKu7znhTs4BP86rMl6p8u4p7a9DKtsyq6V0z4CChvyWCi-omfMaWhif0Lp8_BQ?purpose=inline)

[pulmonaryfellowship.hms.harvard.edu](https://www.pulmonaryfellowship.hms.harvard.edu/lung-transplantation)

Visual direction: a medically inspired, interactive anatomical lung model. Actual lung condition cannot be inferred from cigarette counts alone.

The simulator should offer three distinct modes.

Mode A — Educational visualization

An interactive lung model with an adjustable illustration intensity slider, breathing animation, and clickable anatomical regions.

This mode explains basic lung anatomy and the effects of smoking using medically reviewed educational content. It must not imply that the visualization depicts the user's actual lungs.

Mode B — Custom lung-capacity indicator

Users can manually enter a lung-volume value in liters, or supported spirometry measurements such as FVC and FEV1.

For example:

Capacity indicator demo

Manual input

# 4.3 L

entered volume

Comparison reference

5.0 L

Entered value / selected reference

86%

This comparison uses user-selected numbers. It is not a predicted lung-capacity percentage or a clinical interpretation.

Mode C — Smoking exposure timeline

Displays cumulative cigarette count, estimated pack-years when appropriate, and a timeline of recorded smoking behavior. Pack-years are an exposure measure, not a direct measure of lung damage.

The app must never automatically label a user's lungs as a specific percentage damaged, healthy, or recovered based solely on cigarette logs.

Acceptance criteria:

- Visualization runs smoothly on supported mobile devices.
- Users can disable animation and enable reduced-motion mode.
- Manual capacity measurements preserve their units, dates, and measurement sources.
- Illustrative slider settings never overwrite actual measurement records.
- Clinical-looking visualizations display clear educational disclaimers.
- Invalid or missing medical measurements do not produce fabricated values.

### 2.4 Streaks and goals

BAGA should support multiple types of streaks without encouraging users to smoke.

| Streak type         | Definition                                                                      |
| ------------------- | ------------------------------------------------------------------------------- |
| Smoke-free streak   | Consecutive calendar days with zero cigarettes                                  |
| Within-limit streak | Consecutive days at or below the chosen limit                                   |
| Logging streak      | Consecutive days with a completed daily check-in, including zero-cigarette days |
| Reduction milestone | Progress toward a user-defined consumption reduction goal                       |
| Quit milestone      | Time since the user's selected quit timestamp                                   |

A logging streak must not require smoking a cigarette. A daily zero-cigarette check-in counts as engagement.

Feature: Personalized goals

Users can select a quit date, set daily limits, define weekly reduction targets, or choose tracking-only mode without pressure.

Acceptance criteria:

- Streaks recalculate after a backdated record is edited.
- Time-based milestones use consistent timezone logic.
- Missed tracking days are not automatically assumed to be smoke-free.
- Users can review past streaks and milestones.
- Streak breaks are displayed neutrally, without shame-based messaging.

### 2.5 Additional daily-use features

| Feature            | Description                                                       | Priority |
| ------------------ | ----------------------------------------------------------------- | -------- |
| Craving tracker    | Record cravings without recording a cigarette                     | P1       |
| Trigger insights   | Discover when and why smoking is most frequently recorded         | P1       |
| Expense calculator | Daily, weekly, monthly, and yearly spending summaries             | P0       |
| Savings tracker    | Estimate avoided spending relative to a user-selected baseline    | P1       |
| Smoking calendar   | Color-coded calendar with daily totals                            | P0       |
| Activity history   | Search, filter, and edit cigarette logs                           | P0       |
| Personal records   | Show lowest consumption days and completed milestones             | P1       |
| Daily check-in     | Confirm zero cigarettes or enter missed records                   | P0       |
| Custom themes      | Dark mode, light mode, and accent customization                   | P1       |
| Data export        | Download records as CSV or JSON                                   | P1       |
| Discreet mode      | Hide cigarette-specific details in notifications and app previews | P1       |

## 3. PWA technical requirements and architecture

### 3.1 Recommended technology stack

| Layer              | Technology                          | Purpose                                                        |
| ------------------ | ----------------------------------- | -------------------------------------------------------------- |
| Frontend           | React + TypeScript                  | Component-driven, type-safe application                        |
| Build system       | Vite                                | Optimized production bundles                                   |
| Styling            | Tailwind CSS                        | Responsive design system                                       |
| UI components      | shadcn/ui + Radix UI                | Accessible controls and dialogs                                |
| State management   | Zustand                             | Lightweight application state                                  |
| Server state       | TanStack Query                      | API caching, invalidation, and synchronization                 |
| Local database     | Dexie.js + IndexedDB                | Durable offline cigarette records                              |
| PWA                | Workbox + vite-plugin-pwa           | Service worker and installation support                        |
| Charts             | Recharts                            | Daily and historical smoking statistics                        |
| Lung visualization | Three.js / React Three Fiber        | Optional interactive 3D anatomical visualization               |
| Backend            | Supabase                            | PostgreSQL, authentication, and optional cloud synchronization |
| Validation         | Zod                                 | Runtime validation of user input and API payloads              |
| Testing            | Vitest, Testing Library, Playwright | Unit, component, and end-to-end tests                          |
| Monitoring         | Sentry                              | Privacy-filtered application error reporting                   |

Architecture decision: BAGA should be offline-first and usable without an account. Supabase is introduced only for optional cloud backup, cross-device synchronization, and server-managed services.

This avoids requiring a login just to record a cigarette.

### 3.2 System architecture

React PWA

Dashboard · Tracker · Lungs · Insights

IndexedDB

Logs, preferences, sync queue

Service worker

Offline shell, caching, updates

Optional authenticated HTTPS sync

Supabase backend

Authentication · API · PostgreSQL · RLS

Notification service

Permission management · Scheduled push · Delivery

### 3.3 Service worker caching strategy

| Resource                       | Strategy                            | Behavior                                            |
| ------------------------------ | ----------------------------------- | --------------------------------------------------- |
| Versioned JavaScript/CSS/fonts | Cache First                         | Use immutable cached assets after deployment        |
| App navigation                 | Network First with offline fallback | Prefer current app shell; fall back to cached shell |
| Cigarette catalog              | Stale-While-Revalidate              | Show cached brands immediately and refresh online   |
| Educational articles           | Stale-While-Revalidate              | Display cached content and update in background     |
| Authenticated API reads        | Network First                       | Fall back to authorized local data where supported  |
| Cigarette log writes           | IndexedDB-first                     | Persist locally and queue synchronization           |
| Large 3D assets                | On-demand cache                     | Cache compressed models after first use             |

Authenticated API responses must not be placed in shared or broadly reusable service-worker caches. Sensitive local records require explicit lifecycle and account-isolation controls.

Service-worker updates must not interrupt active data entry. Show a nonblocking update prompt when a new version is ready.

### 3.4 Offline operations

Offline operation is a core product requirement, not a secondary feature.

When the network is unavailable, users must still be able to log cigarettes, view saved history, inspect cached statistics, adjust personal goals, and interact with locally available lung visualizations.

Synchronization workflow:

1. User creates a cigarette log.
2. Application validates the record and writes it to IndexedDB.
3. UI updates after the local transaction succeeds.
4. Record is added to the outbound synchronization queue when cloud sync is enabled.
5. The synchronization engine attempts upload when connectivity returns.
6. The server acknowledges the record and its revision.
7. The queue marks the operation as synchronized.

Use an outbox pattern with stable client-generated UUIDs, idempotency keys, retries with exponential backoff, and explicit conflict handling.

Background Sync may be used where supported, but foreground retry on app launch, network restoration, and visibility changes is mandatory because Background Sync is not universally available.

Conflict resolution: Each record has a revision, `updated_at` timestamp, and deletion marker. Nonconflicting changes merge automatically. Concurrent edits to the same record must be resolved deterministically, with user review for ambiguous conflicts. Never silently resurrect a deleted cigarette log.

### 3.5 Web app manifest

```

{
  "id": "/",
  "name": "BAGA - Cigarette & Lung Tracker",
  "short_name": "BAGA",
  "description": "Track cigarettes, habits, goals and lung-related measurements.",
  "start_url": "/?source=pwa",
  "scope": "/",
  "display": "standalone",
  "display_override": ["standalone", "minimal-ui"],
  "orientation": "any",
  "background_color": "#10151B",
  "theme_color": "#10151B",
  "lang": "en-PH",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "/icons/maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "shortcuts": [
    {
      "name": "Log Cigarette",
      "url": "/log?source=shortcut"
    },
    {
      "name": "My Progress",
      "url": "/insights?source=shortcut"
    },
    {
      "name": "Lung Indicator",
      "url": "/lungs?source=shortcut"
    }
  ]
}

```

The required icon assets must be created during implementation. Install shortcuts and advanced manifest behavior must be feature-tested across supported browsers.

### 3.6 Push notifications

Notifications should help users remember to check in, review their goals, or celebrate smoke-free progress.

Notification categories:

- Daily check-in reminder
- Smoke-free milestone
- Weekly progress summary
- Optional goal review reminder
- Optional quit-plan encouragement

Do not send prompts that encourage smoking or make the user feel obligated to record a cigarette.

Permission flow: First explain the notification benefit within the application. Request operating-system permission only after the user explicitly opts in. Never request permission on the first page load.

Push delivery requires a supported browser, permission, a push subscription, and a backend delivery mechanism. On unsupported devices, use in-app reminders and clearly communicate the limitation. iOS push support has installation and platform-specific conditions.

Notification payloads should be minimal and avoid sensitive cigarette or health details on lock screens by default. Use opaque identifiers and retrieve private details only after authenticated navigation.

### 3.7 Performance budgets

| Metric                               | Production target                          |
| ------------------------------------ | ------------------------------------------ |
| Lighthouse Performance               | ≥90 on representative mobile tests         |
| Lighthouse Accessibility             | ≥95                                        |
| Lighthouse Best Practices            | ≥95                                        |
| Lighthouse SEO                       | ≥90 for public, indexable pages            |
| Largest Contentful Paint (LCP)       | ≤2.5 seconds at p75                        |
| Interaction to Next Paint (INP)      | ≤200 milliseconds at p75                   |
| Cumulative Layout Shift (CLS)        | ≤0.1 at p75                                |
| Time to Interactive (lab diagnostic) | ≤3.5 seconds under defined test conditions |
| Initial JavaScript                   | Target ≤200 KB gzip for core route         |
| Cigarette log local save             | Target ≤100 milliseconds at p95            |

Use lazy loading for charts and 3D assets, compressed geometry, code splitting, route prefetching, and lightweight SVG fallbacks.

The 3D lung model must not block the main dashboard from becoming interactive.

## 4. User journeys and detailed feature epics

### 4.1 First-time onboarding

Open BAGA in browser

Welcome, privacy summary, and product introduction

Choose tracking goal

Track only · Reduce · Quit · Stay smoke-free

Configure preferences

Brand, variant, pack price, daily limit, optional capacity

Enter dashboard

Log cigarette or confirm zero-cigarette day

Optional PWA installation

Prompt after demonstrated value, where supported

Onboarding must be skippable where information is optional. Users must not be required to disclose lung measurements, medical diagnoses, or personal reasons for smoking.

### 4.2 Feature epics and acceptance criteria

| Epic                      | User story                                                         | Critical acceptance criteria                                                                                |
| ------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| E01: Onboarding           | As a new user, I want to start tracking quickly.                   | Setup works without registration; progress persists locally; optional questions can be skipped.             |
| E02: Cigarette logging    | As a user, I want to log my consumption accurately.                | Quantity, brand, timestamp, and price are editable; local persistence is confirmed before success feedback. |
| E03: Lung indicator       | As a user, I want to visualize and enter lung-related information. | Educational simulation is labeled; measured values have sources; no fabricated medical percentages.         |
| E04: Streak tracking      | As a user, I want to monitor consistency and progress.             | Multiple goal types; historical recalculation; zero-cigarette check-ins supported.                          |
| E05: Insights             | As a user, I want to understand patterns.                          | Daily/weekly/monthly charts; spending breakdowns; empty-data explanations.                                  |
| E06: Offline              | As a user, I want reliable logging without internet.               | Local writes work offline; pending sync is visible; conflicts are handled safely.                           |
| E07: Account and backup   | As a user, I want optional cross-device continuity.                | Secure authentication; user-owned data isolation; recoverable sync state.                                   |
| E08: Settings and privacy | As a user, I want control over my records.                         | Edit preferences; export data; clear local data; request cloud deletion.                                    |
| E09: Notifications        | As a user, I want optional reminders.                              | Explicit opt-in; quiet hours; per-category controls; permission revocation supported.                       |
| E10: PWA installation     | As a user, I want an app-like experience.                          | Supported install prompt; iOS instructions; standalone launch; cached offline shell.                        |

### 4.3 Critical edge cases

The implementation must explicitly handle:

- A user logging multiple cigarettes at exactly the same time.
- A user switching between Philippine and international timezones.
- A user changing a cigarette's price after previous purchases.
- A user backdating a record that changes a streak.
- A user deleting the same record on two devices.
- A device going offline halfway through synchronization.
- IndexedDB being unavailable, full, or cleared by the operating system.
- A user changing brands after several months of historical data.
- An uninstalled PWA or revoked notification permission.
- A user entering a capacity value that is physically implausible or in the wrong unit.
- A user with no cigarette records who wants to maintain a smoke-free streak.

The application must never report a record as safely saved when persistent storage has failed.

## 5. UI/UX and adaptive design

### 5.1 Design identity

BAGA should use a modern, dark-first visual identity inspired by premium fitness dashboards, health applications, and minimalist data visualization.

Background

\#10151B

Surface

\#1D2832

Primary

\#58B4A0

Accent

\#E9A56D

Lungs

\#A66875

Design principles: Minimal friction, readable statistics, restrained animations, accessible controls, consistent navigation, and neutral health-related language.

The app should never make cigarettes appear desirable through product photography, promotional graphics, or achievement systems that reward consumption.

### 5.2 Screen inventory

| Screen            | Primary functionality                                   |
| ----------------- | ------------------------------------------------------- |
| Welcome           | Product introduction and privacy explanation            |
| Onboarding        | Goal, brand, price, and preference setup                |
| Dashboard         | Daily consumption, limits, spending, lung preview       |
| Quick Log         | One-tap logging, quantity, and optional details         |
| Cigarette Library | Searchable Philippine brand and variant catalog         |
| Lung Studio       | Interactive model, custom capacity, educational content |
| Insights          | Charts, patterns, spending, and history                 |
| Streaks & Goals   | Goal configuration, milestones, progress                |
| Calendar          | Daily smoking history and zero-cigarette check-ins      |
| Settings          | Theme, privacy, notifications, data management          |
| Account           | Optional sign-in, cloud backup, and synchronization     |

### 5.3 Responsive breakpoints

| Viewport    | Layout requirements                                                        |
| ----------- | -------------------------------------------------------------------------- |
| 320–599 px  | Single column, fixed bottom navigation, full-width primary logging control |
| 600–899 px  | Larger cards, two-column dashboard where space allows                      |
| 900–1199 px | Sidebar navigation, multi-column dashboard                                 |
| ≥1200 px    | Desktop analytics layout, side-by-side charts and lung visualization       |

All interactive targets should be at least 44 × 44 CSS pixels where practical. Support keyboard navigation, visible focus states, accessible chart alternatives, and screen readers.

Use `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` to accommodate notches and home indicators. Fixed navigation must not overlap the system gesture area.

### 5.4 Installation experience

On compatible browsers, use `beforeinstallprompt` where available to offer installation after users have experienced the product.

For iOS and browsers without a programmable install prompt, show platform-appropriate manual instructions. Do not promise that installation can be triggered programmatically on every device.

After installation, use standalone display mode, an app splash experience where supported, and appropriate navigation handling. Users should never be forced to install the app to access its core features.

### 5.5 UI state management

| State             | Required behavior                                                  |
| ----------------- | ------------------------------------------------------------------ |
| Loading           | Skeletons for dashboard cards and charts                           |
| Empty             | Helpful explanation and relevant first action                      |
| Offline           | Subtle offline indicator; locally supported features remain usable |
| Sync pending      | Display pending operation count in settings                        |
| Sync failed       | Retry option and preserved local data                              |
| Error             | Clear, recoverable message without exposing technical internals    |
| Goal completed    | Restrained celebration with reduced-motion support                 |
| Data unavailable  | Explain missing information without inventing measurements         |
| Permission denied | Provide alternative functionality and settings guidance            |

## 6. Security, privacy, and compliance

Smoking history and lung-related measurements are sensitive personal information. Privacy must be built into the architecture from the beginning.

### 6.1 Security requirements

- Enforce HTTPS and TLS 1.2 or later, preferably TLS 1.3.
- Enable HSTS, a restrictive Content Security Policy, Referrer-Policy, and appropriate Permissions-Policy.
- Use secure authentication with optional passkeys or platform-supported biometric verification through WebAuthn.
- Store cloud credentials securely; never store authentication passwords in IndexedDB.
- Use PostgreSQL Row Level Security to isolate each user's records.
- Validate and authorize every server operation.
- Protect write endpoints against abuse and enforce request size limits.
- Do not include cigarette logs, lung measurements, or sensitive notes in error-monitoring payloads.
- Encrypt backend storage and backups at rest.
- Provide account deletion and data export workflows.
- Use dependency scanning, secret scanning, and automated security tests in CI.

Because IndexedDB does not provide universal application-level encryption, the app must clearly explain the limitations of local device storage. Device encryption and optional cloud encryption do not eliminate risks from shared or compromised devices.

### 6.2 Privacy and legal compliance

The product should be designed with the Philippine Data Privacy Act of 2012 (Republic Act No. 10173) and applicable National Privacy Commission guidance in mind.

GDPR and CCPA/CPRA obligations should also be evaluated if the app serves users in jurisdictions where those laws apply.

Requirements include data minimization, clear privacy notices, appropriate consent or other lawful processing bases, retention rules, deletion workflows, and vendor agreements where necessary.

Analytics must not collect raw cigarette logs, lung-capacity measurements, or identifiable health profiles by default.

### 6.3 Health and medical safeguards

BAGA must not claim to diagnose lung disease, predict cancer risk, or calculate actual lung damage from cigarette counts.

Educational recovery timelines and health information must be sourced from qualified medical references and reviewed before publication.

The product should avoid giving false reassurance when cigarette consumption decreases. Reduced smoking does not necessarily establish improved lung function, and the app must not suggest that one cigarette brand is medically safer than another.

Any future integration that interprets clinical spirometry results requires separate medical, regulatory, and professional review.

## 7. Analytics and product instrumentation

Use privacy-conscious analytics with clear consent controls and documented event definitions.

| Event                        | Trigger                                |
| ---------------------------- | -------------------------------------- |
| `onboarding_started`         | User begins setup                      |
| `onboarding_completed`       | Required onboarding steps completed    |
| `cigarette_logged`           | Record successfully persisted locally  |
| `cigarette_log_edited`       | Existing record modified               |
| `daily_checkin_completed`    | User confirms daily tracking status    |
| `goal_created`               | User creates a reduction or quit goal  |
| `goal_completed`             | Defined goal milestone reached         |
| `lung_visualization_opened`  | User enters Lung Studio                |
| `capacity_measurement_saved` | User saves a manual measurement        |
| `install_prompt_shown`       | Eligible installation prompt displayed |
| `app_installed`              | Installation detected where supported  |
| `offline_log_created`        | Record saved while offline             |
| `sync_completed`             | Queued synchronization succeeds        |
| `notification_clicked`       | User opens the app from a notification |

Event payloads should use anonymous or pseudonymous identifiers and avoid transmitting sensitive values unless a specific lawful purpose and user permission justify them.

The analytics dashboard should report retention, active users, feature adoption, installation conversion, offline reliability, and application performance.

## 8. Data model and API requirements

### 8.1 Core entities

| Entity                     | Important fields                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `users`                    | id, timezone, locale, created_at                                                          |
| `user_preferences`         | user_id, theme, favorite_brand_id, currency, reminder_settings                            |
| `cigarette_brands`         | id, name, country, active                                                                 |
| `cigarette_variants`       | id, brand_id, name, pack_size                                                             |
| `cigarette_logs`           | id, user_id, variant_id, quantity, smoked_at, price_snapshot, notes, revision, deleted_at |
| `custom_cigarettes`        | id, user_id, name, variant, pack_size                                                     |
| `goals`                    | id, user_id, goal_type, target, start_at, end_at                                          |
| `daily_checkins`           | id, user_id, local_date, confirmed_count, status                                          |
| `lung_measurements`        | id, user_id, measurement_type, value, unit, source, measured_at                           |
| `simulation_preferences`   | user_id, visual_intensity, animation_enabled                                              |
| `notification_preferences` | user_id, category, enabled, quiet_hours                                                   |
| `sync_operations`          | id, entity_id, operation_type, revision, status, retry_count                              |

All user-owned records must be isolated by authenticated user ID in the backend. Anonymous local records should use a device-local profile identifier until account linking is requested.

Store cigarette price snapshots with historical records so changing today's price does not incorrectly recalculate past spending.

### 8.2 API design

Use versioned REST endpoints for the optional cloud service.

```

POST   /api/v1/sync/batch
GET    /api/v1/brands
GET    /api/v1/brands/:id/variants

GET    /api/v1/logs
POST   /api/v1/logs
PATCH  /api/v1/logs/:id
DELETE /api/v1/logs/:id

GET    /api/v1/goals
POST   /api/v1/goals
PATCH  /api/v1/goals/:id

GET    /api/v1/measurements
POST   /api/v1/measurements

GET    /api/v1/preferences
PATCH  /api/v1/preferences

POST   /api/v1/push/subscriptions
DELETE /api/v1/push/subscriptions/:id

GET    /api/v1/export
DELETE /api/v1/account

```

API requirements:

- All write requests use validated schemas.
- Sync mutations use idempotency keys.
- Pagination uses stable cursors.
- Authenticated endpoints enforce user ownership.
- Errors return consistent machine-readable codes.
- Deletions use tombstones until synchronization and retention requirements are satisfied.
- Brand catalog data is versioned and can be updated without requiring an application deployment.

## 9. Release roadmap and delivery priorities

Phase 1: Foundation

Weeks 1–2

Design system, data model, local storage, PWA shell, brand catalog

Phase 2: Core tracking

Weeks 3–4

Quick logging, dashboard, calendar, goals, streak calculations

Phase 3: Lung Studio and insights

Weeks 5–6

Capacity input, educational visualization, spending and trend charts

Phase 4: Offline and cloud

Weeks 7–8

Sync engine, optional authentication, conflict handling, notifications

Phase 5: Hardening and launch

Weeks 9–10

Accessibility, performance, security, privacy review, beta testing

The ten-week schedule is an illustrative estimate for an experienced small product team. Actual delivery depends on team size, medical-content review, 3D asset production, and the complexity of synchronization.

### 9.1 Quality assurance and testing

Testing must cover unit, integration, end-to-end, offline, accessibility, and cross-browser scenarios.

Priority test scenarios include:

- Logging and editing cigarettes offline.
- Synchronizing duplicate operations without duplicate records.
- Restoring the app after a forced close.
- Updating a goal while another device is offline.
- Installing on supported Android and iOS browsers.
- Revoking notifications.
- Importing and exporting records.
- Changing timezones across midnight.
- Loading the lung visualization on low-memory devices.
- Verifying that all lung-related illustrations and measurements remain appropriately labeled.

### 9.2 Production release gates

The MVP is ready for public launch only when:

- All P0 acceptance criteria pass.
- Core tracking works offline after the initial successful installation/load.
- No critical or high-severity security vulnerabilities remain unresolved.
- All sensitive-data collection and deletion workflows have been reviewed.
- The app meets the agreed performance and accessibility targets.
- Cross-browser installation and fallback behavior have been tested.
- Health content and simulation disclaimers have passed review.
- Backup, synchronization, and disaster-recovery procedures are documented.
- Error monitoring, operational alerts, and rollback procedures are in place.

## 10. Recommended post-MVP differentiators

BAGA can expand beyond cigarette logging while retaining a focused product identity.

[Cigarette Tracking Screen by Alex ✦ Borsuk  on Dribbble](https://images.openai.com/static-rsc-4/gFVwer0WSLd2kyrAVjIbYpfSvygMi3FjXslOgbsrK2m7DZyPrGz6T9w9386K2USwckYSwfTmz1Itg1WJNDuD2bdN-U9YE8gLCkCTscFm1TgP55m1AQ7aq1XbIdM96D8sW7Tfpek-4Sl5RvLkTZatEZJTHt1TJTZzp5fzY707J1s?purpose=inline)

Smoking Pattern Heatmap

A calendar or hourly heatmap identifying when cigarettes are most frequently logged, helping users recognize patterns without judgment.

[finpal: AI Finance Assistant App - Intelligent Budgeting UIUX by finterface on Dribbble](https://images.openai.com/static-rsc-4/Wm7CUOKY26oesTWK-g9B8ewQl3akEK_l2iX0XHmP23OzmHaUJQxLT5qmc_4CPQkCAKSnKig1hdM4Gy03EZlLxFeRi4lAwO8tc4NKPWqxOtmdNW_A3YCaQ8gVc_GJd4tXQ7xZyHoUsgsYemLXYPBHsEqRp6QkqWDG82tQPfL_6WU?purpose=inline)

Peso Impact Tracker

Displays spending trends, estimated savings against a user-defined baseline, and optional financial goals in Philippine pesos.

[The 5 best habit tracker apps | Zapier](https://images.openai.com/static-rsc-4/9TG-N0grPVR-SJ6_8B2euWDfnD4HQsq6ZD58WkudYLkcK3dnHboL1GpLp5dbTnSwXYhNidrpATNEq8jdOTDzcva9VakqW16avfinOalbX_-ZGA948ZlNH04NE78CdW8v9uH4xQvua4YVgpdhP3xpOh-7o9SR-I9YMNGmwU-DUr0?purpose=inline)

Personal Milestone System

Rewards consistent check-ins, meeting reduction goals, and smoke-free milestones without rewarding cigarette consumption.

## 11. Final product direction

The defining experience of BAGA should be:

Open the app → Log or confirm today's cigarette consumption → See updated statistics → Review personal progress → Understand patterns over time.

The lung simulator makes the app visually distinctive, the Philippine cigarette catalog makes it locally relevant, and the tracking/streak system gives users a practical reason to return daily.

For implementation, I recommend prioritizing a reliable, offline-first tracker and an attractive but medically responsible 2D lung visualization before investing heavily in complex 3D effects. This protects performance, reduces development risk, and ensures that the central product is genuinely useful.

The result should be a privacy-conscious, polished PWA that works well as an everyday cigarette diary and supports users who choose to reduce or stop smoking.