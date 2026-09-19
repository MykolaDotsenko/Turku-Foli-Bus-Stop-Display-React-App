# Föli Live Departures

A focused React departure board for Turku region public transport. Enter a Föli stop number to see the next arrivals, expected times, delay status, and whether each estimate is based on live vehicle data.

## What the app demonstrates

- integration with Föli's public SIRI Stop Monitoring API
- resilient polling that refreshes every 30 seconds only while the tab is visible
- manual refresh without discarding previously loaded data
- request cancellation when the selected stop changes
- explicit loading, empty, stale/error, scheduled, and real-time states
- cached stop catalog for lightweight stop-number suggestions
- accessible semantic departure table
- responsive UI with no additional design-system dependency
- correct handling of Föli delay values as seconds
- source attribution for the CC BY 4.0 dataset

## Architecture

```text
Föli SIRI API
    ↓
src/api/foliApi.js
    ↓
useStopMonitor / useStopCatalog
    ↓
App
    ↓
BusStopForm + BusStopDisplay
```

The API module owns transport and response validation. Hooks own lifecycle, polling, cancellation, caching, and UI state. Components stay focused on interaction and presentation.

## Reliability decisions

Föli documents Stop Monitoring as a real-time estimate rather than a guaranteed arrival time. The API can also temporarily return unavailable or stale information.

The app therefore:

- keeps the most recent successful departures on screen when a refresh fails
- shows an explicit warning instead of replacing useful data with an empty state
- distinguishes monitored real-time arrivals from scheduled arrivals
- pauses automatic polling in background tabs
- uses a 30-second refresh interval, aligned with the API's own stop-response caching behavior
- uses an 8-second network timeout and aborts obsolete requests

## Stack

- React 18
- Create React App
- Axios
- CSS Modules
- Testing Library / Jest
- Föli SIRI Stop Monitoring API

The project deliberately remains a small React application. Migrating frameworks would add churn without improving the product or architecture.

## Local development

```bash
npm ci
npm start
```

Then open `http://localhost:3000`.

### Optional API override

By default the application uses:

```text
https://data.foli.fi/siri/sm
```

For another compatible endpoint:

```bash
REACT_APP_FOLI_API_URL=https://example.test/siri/sm npm start
```

## Quality checks

```bash
npm test -- --watchAll=false
npm run build
```

GitHub Actions runs both checks for pushes and pull requests.

## Data source

Source: Turku region public transport transit and timetable data, maintained by Turku region public transport and distributed through `data.foli.fi` under the Creative Commons Attribution 4.0 International license (CC BY 4.0).

API documentation: https://data.foli.fi/doc/siri/v0/sm-en
