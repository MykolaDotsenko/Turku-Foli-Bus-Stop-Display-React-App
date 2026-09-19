# Föli Live Departures

A small, production-minded React departure board for Turku region public transport.

Enter a Föli stop number and get the information that matters most: **line, destination, and time to departure**.

## Product principles

- one primary task: check the next departures
- departure time is preferred over arrival time
- scheduled vehicles are never presented as real-time
- failed refreshes keep the last successful data for the same stop
- data from one stop can never appear under another stop number
- selected stops are bookmarkable with `?stop=<id>`
- background tabs do not keep polling unnecessarily
- no state library, design system, backend, or framework migration

## Architecture

```text
Föli SIRI API
    ↓
api/foliApi.js
    ↓
hooks/
  useStopMonitor.js
  useStopCatalog.js
    ↓
App.js
    ↓
BusStopForm + BusStopDisplay
```

Responsibilities stay explicit:

- **API module** — HTTP and response validation
- **hooks** — polling, cancellation, caching, and UI state
- **utils** — pure time/status formatting
- **components** — interaction and presentation

## Reliability

The app:

- polls every 30 seconds while the tab is visible
- refreshes when the user returns to the tab
- aborts obsolete requests
- uses an 8-second request timeout
- preserves same-stop data during temporary API failures
- clears previous-stop data immediately on stop changes
- handles loading, empty, stale, scheduled, and failed states explicitly
- caches the stop catalog for 24 hours without making it a requirement

Föli's Stop Monitoring API distinguishes planned and estimated arrival/departure times. This project uses:

```text
expecteddeparturetime
→ expectedarrivaltime
→ aimeddeparturetime
→ aimedarrivaltime
```

as a defensive fallback order.

## Stack

- React 18
- Create React App
- Axios
- CSS Modules
- Jest + Testing Library
- GitHub Actions
- Föli SIRI Stop Monitoring API

## Run locally

```bash
npm ci
npm start
```

Optional compatible API override:

```bash
REACT_APP_FOLI_API_URL=https://example.test/siri/sm npm start
```

## Quality checks

```bash
npm test -- --watchAll=false
npm run build
```

CI runs both checks on pushes and pull requests.

## Data source

Source: Turku region public transport transit and timetable data, maintained by Turku region public transport and distributed through `data.foli.fi` under the Creative Commons Attribution 4.0 International license (CC BY 4.0).

API documentation: https://data.foli.fi/doc/siri/v0/sm-en
