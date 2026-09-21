# Föli Live Departures

![CI](https://github.com/MykolaDotsenko/foli-live-departures/actions/workflows/ci.yml/badge.svg)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-offline--ready-5A0FC8)
![License](https://img.shields.io/badge/license-MIT-blue)

**Privacy-first realtime public transport companion for Turku.**

Live departures, disruptions, nearest stops, Safe Places and resilient **Get me Home** recovery — built as a local-first accessible PWA on top of Föli open data.

<p>
  <a href="#product-preview"><strong>Product preview</strong></a>
  ·
  <a href="docs/PRODUCT_AUDIT.md">Product audit</a>
  ·
  <a href="docs/FOLI_API_REFERENCE.md">Föli API contract</a>
</p>

<a id="product-preview"></a>

<p align="center">
  <img
    src="docs/assets/foli-desktop.webp"
    alt="Föli Live Departures showing realtime departures, service updates and daily travel actions"
    width="920"
  >
</p>

<p align="center">
  <img
    src="docs/assets/foli-mobile.webp"
    alt="Föli Live Departures mobile experience with stop search and upcoming departures"
    width="320"
  >
</p>

> **Independent portfolio project.** Not an official Föli application.

## What it does

Föli Live Departures answers the everyday transit question quickly — **what leaves next, from where, and is there anything important I should know before I go?**

It also handles less ideal situations: poor connectivity, an unfamiliar area, a child or newcomer trying to get home, a temporarily unavailable stop, stale realtime data, or a provider disruption.

### Core product capabilities

- **Realtime departure board** with conservative Live/Scheduled semantics and stale-data handling
- **Stop search, favorites and recents** for fast repeat journeys
- **Nearest-stop discovery** with one-time geolocation, uncertainty checks and nearby alternatives
- **Service disruption intelligence** across stop-level, route-level and emergency alerts
- **Safe Places** for Home, School and Work using public stop identities instead of private addresses
- **Get me Home** recovery with transit handoff, backup stops, driver card and printable no-battery fallback
- **Offline-capable PWA shell** that keeps saved recovery information available when the network disappears
- **Accessible mobile-first UX** validated with Playwright and axe across Chromium, Firefox and WebKit

## Why this project is more than a departure-board demo

The project is intentionally small in infrastructure and demanding in product behavior.

There is **no backend, account system, map SDK, analytics SDK or global state library**. The application instead relies on focused React hooks, browser APIs and explicit provider-boundary normalization.

The harder engineering work is in the edge cases:

- realtime data can become stale without becoming obviously broken
- a failed refresh must not make old departures look fresh
- data from one stop must never appear under another stop
- route disruptions may matter even when no matching realtime row exists
- GPS accuracy can be too poor to safely auto-select a stop
- the physically closest stop can serve the wrong direction
- accessibility and mobile behavior must survive dense realtime content
- offline recovery must remain useful without pretending live transit still works
- browser Back/Forward must switch stops without stale state or render-loop regressions

Those cases are covered by explicit product rules and automated release gates rather than optimistic UI assumptions.

## Stack

| Area | Technology |
| --- | --- |
| UI | React 18, CSS Modules |
| Build | Vite 8 |
| Realtime/data | Axios, Föli SIRI + GTFS + alerts APIs |
| Local state | React hooks, Web Storage |
| Browser capabilities | Geolocation, History, Visibility, Service Worker, Web Share, Clipboard, AbortController |
| Unit/integration tests | Vitest, Testing Library |
| Browser QA | Playwright |
| Accessibility | axe |
| CI | GitHub Actions |
| Delivery model | Installable local-first PWA |

## Product highlights

### Realtime that degrades honestly

The departure board prefers Föli estimated departure/arrival data and falls back to planned times only when needed.

A trip is labelled **Live** only when the provider marks it monitored. The application records when a successful payload reached the browser and advances provider time locally, so an outage cannot freeze an old payload in a misleadingly fresh state.

Temporary provider failures keep useful same-stop data visible while clearly degrading freshness.

### Privacy-first Safe Places

Home, School and Work are represented as **Safe Arrival Zones** made from up to three public Föli stops.

The app does not need to persist a private street address or exact setup coordinates. One-time location can help discover nearby public stops; the exact position is discarded after setup.

Shared Safe Places contain public stop identity only and require explicit confirmation before replacing local data.

### Get me Home recovery

After Home is configured, a dedicated recovery action is promoted near the top of the experience.

It provides independent fallbacks:

- **Go Home** — external public-transit handoff to the primary saved stop
- **Open Home stop** — reopen the local departure board
- **Show driver** — large destination card with a simple Finnish help sentence
- **Backup Home stops** — user/parent-approved alternatives
- **Prepare for no battery** — printable public-stop-only recovery card

The interface deliberately describes this as travel help, not an emergency service.

### Location without overconfidence

Nearest-stop discovery uses one-time browser geolocation and local Haversine calculations.

Automatic selection is withheld when accuracy is poor, the device appears outside the published service area, the network is unexpectedly far away, or two stops are effectively tied inside the uncertainty margin.

The app exposes alternatives because “nearest” does not necessarily mean “correct travel direction”.

### Accessible by design

Accessibility is part of CI rather than a post-build checklist.

The application includes:

- semantic status and alert regions
- accessible combobox/listbox interaction
- keyboard autocomplete
- large mobile touch targets
- visible focus states
- reduced-motion and forced-colors support
- runtime contrast correction for provider-supplied route colors
- screen-reader-aware loading, invalid, busy and pressed states
- WCAG 2 A/AA, 2.1 AA and 2.2 AA serious/critical axe gates

## Architecture

~~~text
Föli SIRI + GTFS + Alerts
        │
        ▼
api/foliApi.js
provider normalization + defensive contracts
        │
        ▼
React hooks
├─ useStopMonitor       realtime polling + stale-data safety
├─ useStopCatalog       stop search + progressive GTFS enrichment
├─ useRouteCatalog      route identity / colors
├─ useStopAlerts        disruption matching
├─ useServiceBoundary   local service-area checks
├─ useSavedStops        favorites / recents
├─ useSavedPlaces       privacy-first Safe Places
└─ useOnlineStatus      degraded/offline capability state
        │
        ▼
Product UI
├─ HomeRecovery
├─ BusStopForm
├─ QuickStops
├─ ServiceAlerts
├─ BusStopDisplay
├─ NearbyStops
└─ MyPlaces
        │
        ▼
Browser platform
History · Geolocation · Storage · Visibility · Service Worker
~~~

The architecture deliberately avoids a router, backend and global state library because the product scope does not require them. That keeps provider semantics, lifecycle behavior and recovery logic visible and testable.

## Reliability model

The application is defensive around both provider data and browser lifecycle behavior:

- 30-second visible-tab departure refresh
- immediate refresh when returning to the tab
- request cancellation with AbortController
- 8-second HTTP timeouts
- same-stop stale-data retention after transient failures
- strict cross-stop stale-data isolation
- progressive stop catalogue enrichment
- conservative alert refresh and local re-filtering
- no caching of live Föli API responses in the service worker
- content-versioned same-origin PWA shell precache
- explicit online/offline capability messaging
- stable state identities during stop transitions to prevent synchronous render loops
- deterministic browser-history regression coverage

The browser Back/Forward regression is specifically protected after a real production bug was traced to referential instability in pending stop data and alert membership state.

## Quality gates

Every pull request to `master` runs the same production-oriented checks:

| Gate | What it protects |
| --- | --- |
| ESLint | JavaScript/JSX correctness and React Hooks rules |
| Vitest + Testing Library | timing, persistence, privacy, geolocation, alerts and failure semantics |
| Production build | Vite compilation + service-worker generation |
| PWA verification | generated assets are represented in the production precache |
| Bundle budget | prevents uncontrolled frontend growth |
| Playwright · Chromium | core daily flow, recovery, geolocation and screenshots |
| Playwright · Firefox | cross-browser behavior |
| Playwright · mobile WebKit | iPhone-sized interaction and layout |
| Playwright · Chromium mobile | Android-sized interaction and layout |
| Playwright · Chromium PWA | real service-worker install + offline reopen |
| axe | serious/critical WCAG regressions |
| Mobile overflow | guards against page-level horizontal scrolling |

Browser scenarios mock documented Föli contracts so provider incidents cannot make CI flaky. A dedicated PWA project separately exercises the real generated service worker and offline application shell.

The desktop and mobile screenshots above are generated from deterministic Playwright product flows.

## Data and provider semantics

The application uses Turku region public transport open data:

- SIRI Stop Monitoring
- GTFS stops
- GTFS routes
- service alerts
- service-area geometry where available

Provider data is normalized at the application boundary instead of being passed directly into components.

Detailed field-level behavior, fallbacks and known provider limitations are documented in **[Föli API Reference](docs/FOLI_API_REFERENCE.md)**.

For the adversarial product review, fixed risks and deliberately unresolved limitations, see **[Product Audit](docs/PRODUCT_AUDIT.md)**.

## Run locally

Requires Node.js 20.19+.

~~~bash
npm ci
npm run dev
~~~

Production verification:

~~~bash
npm run lint
npm test
npm run build
npm run verify:api-reference
npm run verify:pwa
npm run verify:bundle
npx playwright install --with-deps chromium firefox webkit
npm run test:e2e
~~~

Optional compatible API overrides:

~~~bash
VITE_FOLI_API_URL=https://example.test/siri/sm npm run dev
VITE_FOLI_ALERTS_URL=https://example.test/alerts npm run dev
VITE_FOLI_GTFS_URL=https://example.test/gtfs/ npm run dev
VITE_FOLI_STOPS_URL=https://example.test/gtfs/stops npm run dev
VITE_FOLI_ROUTES_URL=https://example.test/gtfs/routes npm run dev
~~~

## Repository map

~~~text
src/
├─ api/          Föli provider normalization and HTTP boundary
├─ components/   product UI
├─ hooks/        realtime, persistence and browser lifecycle logic
└─ utils/        pure geo, time, route, alert and sharing helpers

e2e/             cross-browser product and accessibility QA
scripts/         production PWA / bundle / provider-contract verification
docs/            product audit, provider reference and recruiter screenshots
.github/         CI and live contract smoke checks
~~~

## Data attribution

Transit and timetable data is maintained by Turku region public transport and distributed through `data.foli.fi` under **CC BY 4.0**.

Application source code is available under the **MIT License**.

---

Built as an independent product engineering portfolio project around a real public transport system, real provider failure modes and real everyday recovery scenarios.
