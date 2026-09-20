# Föli Live Departures

A fast, local-first departure board for Turku-region public transport, designed for the everyday moment when you need to answer one question quickly:

> **When does my next bus leave?**

**Live demo:** https://nuppu-assignment.vercel.app

## Daily workflow

1. Search by **stop name or stop number**.
2. Read the next departures at a glance.
3. Save a frequent stop with **☆**.
4. Return to favorites or recent stops in one tap.
5. Trust the status: **Live** means realtime vehicle data; **Scheduled** does not.

No account, backend, tracking, or setup is required. Favorites and recents stay in the browser.

## UX decisions

- stop-name search removes the need to remember numeric stop IDs
- keyboard-friendly autocomplete supports ↑ / ↓ / Enter / Escape
- favorites optimize repeated commute flows
- recent stops recover common journeys automatically
- active stop-specific service messages and cancellations appear before departures
- bookmarkable stop query URLs make stops shareable
- browser Back/Forward follows stop navigation
- the board keeps line, destination, and due time visually dominant
- mobile controls use large touch targets and a single-column search action
- loading, empty, stale, scheduled, realtime, and failed states are explicit
- failed refreshes keep the last successful data for the same stop
- data from one stop can never render under another stop number

## Realtime semantics

Föli Stop Monitoring exposes both planned and estimated times. The board prefers:

~~~text
expecteddeparturetime
→ expectedarrivaltime
→ aimeddeparturetime
→ aimedarrivaltime
~~~

A vehicle is only labelled **Live** when monitored is true.

recordedattime is compared with the Föli servertime; older vehicle updates are surfaced as aged live data instead of pretending that every realtime estimate has equal freshness.

Föli documents that Stop Monitoring replies may be cached by the provider for roughly 15–30 seconds and that realtime estimates can vary with traffic, connectivity, signals, and passenger loading. The UI therefore treats realtime values as estimates rather than promises.

## Architecture

~~~text
Föli SIRI API
    ↓
api/foliApi.js
  normalize + validate provider data
    ↓
hooks/
  useStopMonitor.js   polling + cancellation + stale-data safety
  useStopCatalog.js   24h optional stop catalogue cache
  useSavedStops.js    local-first favorites + recents
  useStopAlerts.js     low-frequency active disruption polling
    ↓
App.jsx
    ↓
BusStopForm.jsx     search / autocomplete
QuickStops.jsx      favorites / recents
ServiceAlerts.jsx   relevant disruptions and cancellations
BusStopDisplay.jsx  live departure board
    ↓
utils/time.js       pure timing + freshness semantics
~~~

The app intentionally avoids a router, global state library, backend, and design system. The product is small enough that browser APIs and focused React hooks keep the architecture easy to inspect and maintain.

## Reliability

- 30-second polling while the page is visible
- immediate refresh when returning to the tab
- obsolete requests are aborted
- HTTP requests time out after 8 seconds
- same-stop data survives temporary refresh failures
- cross-stop stale-data leakage is prevented
- provider payloads are normalized before reaching the UI
- malformed arrivals are ignored defensively
- stop catalogue caching is optional, not required for the core flow
- background tabs do not create unnecessary Föli API load
- stop alerts refresh conservatively every five minutes while visible

## Accessibility

- semantic headings, form labels, table headers, status and alert regions
- accessible combobox/listbox semantics
- full keyboard autocomplete navigation
- visible focus states
- ARIA busy, live, invalid, and pressed states
- reduced-motion support
- forced-colors-aware styling
- touch-friendly controls

## Stack

- React 18
- Vite 8
- Vitest 5
- Testing Library
- Axios
- CSS Modules
- browser History, Storage, Visibility and AbortController APIs
- GitHub Actions
- Föli SIRI Stop Monitoring API
- Föli service alerts API

## Run locally

~~~bash
npm ci
npm run dev
~~~

Optional compatible API override:

~~~bash
VITE_FOLI_API_URL=https://example.test/siri/sm npm run dev
~~~

## Quality checks

~~~bash
npm test
npm run build
~~~

CI runs both checks on pushes and pull requests using Node 24.

Tests cover departure-time semantics, delay/status formatting, stop ordering, failure states, stale-data safety, autocomplete selection, keyboard navigation, favorites, and recent-stop deduplication.

## Data source

Source: Turku region public transport transit and timetable data, maintained by Turku region public transport and distributed through data.foli.fi under the Creative Commons Attribution 4.0 International license (CC BY 4.0).

Official Stop Monitoring documentation: https://data.foli.fi/doc/siri/v0/sm-en

This project is an independent portfolio project and is not an official Föli application.
