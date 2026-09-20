# Föli Live Departures

![CI](https://github.com/MykolaDotsenko/Turku-Foli-Bus-Stop-Display-React-App/actions/workflows/ci.yml/badge.svg)

A fast, local-first departure companion for Turku-region public transport. It is optimized for the everyday question:

> **When does my next bus leave — and is there anything I need to know before I go?**

<p align="center">
  <img src="docs/assets/foli-desktop.webp" alt="Föli Live Departures desktop view showing service updates and live departures for Kauppatori" width="900">
</p>

<p align="center">
  <img src="docs/assets/foli-mobile.webp" alt="Föli Live Departures mobile view with stop search, service update and upcoming departures" width="320">
</p>

These screenshots are generated from the same deterministic Playwright flow that runs in CI.

## Daily workflow

1. Save **Home, School or Work** once as a **Safe Arrival Zone** made from 1–3 public Föli stops — no private address required.
2. Tap **Go Home / Go to School / Go to Work** to open public-transit directions to the primary safe stop. The external URL omits the user's origin.
3. If location access is unavailable, search/select a stop normally and save that public stop to My Places.
4. Tap **Find nearest stop** for a one-time location lookup, or search by **stop name / stop number**.
5. Compare the three closest stops and their approximate straight-line distances when direction matters, then tap **Walk there** for walking directions.
6. See active **stop- and route-level disruptions, cancellations, global notices, and emergency messages before departures**.
7. Scan line, destination, due time, realtime status, official Föli route identity, and — when available — the live vehicle's approximate distance from the stop.
8. Save frequent stops with **☆** and return to favorites or recent stops in one tap.
9. Use **Show driver** when a child or newcomer needs a simple destination card instead of remembering or pronouncing an address.

No account, backend, or tracking is required. Favorites, recents and My Places stay in the browser. My Places stores public stop IDs/names only; the exact location used during setup is discarded. Location is requested only after a user action.

## Product decisions

- **My Places** replaces memorized private addresses with intent-based destinations such as Home, School and Work
- each place is a **Safe Arrival Zone** of up to three public Föli stops; one is primary and the others are backups
- setup by **where I am now** uses one-time geolocation only to discover nearby public stops, then discards the exact position
- a no-geolocation fallback lets the user search/select a stop and save that public stop directly
- **Go Home / School / Work** launches keyless transit directions to the primary public stop with no origin embedded in the URL
- **Show driver** provides a large stop-focused destination card plus a simple Finnish help sentence
- a parent/teacher can **Share Home / School / Work** without an account; the link contains only the Safe Arrival stop identity
- shared Safe Places use a URL fragment rather than a query parameter, so the share payload is not sent to the web server as part of the HTTP request
- opening a shared place never overwrites local data automatically: the recipient must explicitly Add or Replace it
- place editing/removal is kept behind Manage instead of exposing destructive controls in the main child-friendly flow
- one-tap geolocation removes the need to know a nearby stop's name or number
- the closest stop is selected automatically only when location quality is reasonable, the device is near the Föli network, and one candidate is meaningfully closer than the next
- the three nearest alternatives remain visible because the physically closest stop may serve the wrong travel direction
- location accuracy is exposed instead of pretending GPS/Wi-Fi positioning is exact
- stop distances are labelled as approximate straight-line distances rather than walking-route distances
- each nearby stop can open keyless walking directions in Google Maps without bundling a map SDK
- user coordinates are never stored and there is no background location tracking
- stop-name search removes the need to remember numeric stop IDs
- search tolerates partial names and missing Finnish diacritics
- keyboard autocomplete supports ↑ / ↓ / Enter / Escape
- favorites optimize repeated commute flows
- recent stops recover common journeys automatically
- stop-specific and route-specific service messages appear before the board
- global Föli notices are included and emergency messages replace lower-priority disruption content
- semantic alert effects such as Detour, Stop moved, Significant delays and No service are surfaced directly
- detailed alert information stays collapsed until the user asks for it
- official GTFS route colors and names improve line recognition without hard-coded branding
- route text colors are contrast-checked at runtime and corrected when the provider color pair would fail WCAG AA
- monitored SIRI vehicle coordinates are converted into an approximate vehicle-to-stop distance
- line, destination, and due time remain the strongest visual hierarchy
- mobile controls use large touch targets and collapse into a simple one-column action flow
- loading, empty, stale, scheduled, realtime, and failed states are explicit
- a temporary refresh failure keeps the last successful same-stop data
- data from one stop can never render under another stop number
- the app shell can be installed as a PWA, while live Föli API responses are never cached by the service worker

## Location semantics

Föli GTFS provides WGS84 stop coordinates through `stop_lat` and `stop_lon`. SIRI stop search and GTFS coordinates are fetched independently: stop-name/number search can become usable as soon as SIRI responds, while coordinates enrich the cached catalogue asynchronously.

When the user taps **Find nearest stop**:

1. the browser asks for location permission
2. the app requests a high-accuracy one-time position, with a lower-power timeout fallback
3. distances are calculated locally with the Haversine formula
4. the three nearest active Föli stops are ranked
5. the nearest stop is auto-selected only when:
   - reported location accuracy is at most 250 m,
   - the nearest stop is within 10 km, and
   - the second-nearest candidate is not effectively tied within the uncertainty margin
6. poor accuracy, an unexpectedly distant network result, or two nearly tied stops is surfaced as a warning instead of silently making a strong assumption

No map SDK, geocoding service, analytics service, or location backend is required. **Walk there** uses a standard Google Maps URL with only the public stop destination; the app does not put the user's current coordinates into the external URL.

## Realtime semantics

Föli Stop Monitoring exposes both planned and estimated times. The board uses this defensive order:

~~~text
expecteddeparturetime
→ expectedarrivaltime
→ aimeddeparturetime
→ aimedarrivaltime
~~~

A vehicle is labelled **Live** only when `monitored === true`. Otherwise the trip is shown as **Scheduled**.

`recordedattime` is compared with Föli `servertime`. Older vehicle updates are exposed as aged live data rather than presenting every realtime estimate as equally fresh.

The UI intentionally treats realtime values as estimates rather than promises.

## Architecture

~~~text
Föli SIRI + GTFS Stops/Routes + Alerts APIs
        ↓
api/foliApi.js
  normalize provider data
  keep monitored SIRI vehicle coordinates
  normalize GTFS stop + route metadata
        ↓
hooks/
  useStopMonitor.js   30s visible-tab polling + cancellation + stale-data safety
  useStopCatalog.js   non-blocking SIRI catalogue + async GTFS enrichment
  useRouteCatalog.js  cached route identity/colors for line recognition + alerts
  useSavedStops.js    local-first favorites + recents
  useSavedPlaces.js   privacy-first Home / School / Work safe-stop zones
  useStopAlerts.js    conservative active-disruption polling
        ↓
App.jsx
        ↓
BusStopForm.jsx       search / accessible autocomplete
NearbyStops.jsx       one-time geolocation / nearest-stop ranking / walking handoff
MyPlaces.jsx          Safe Arrival Zones + transit handoff + driver card + explicit share/import
QuickStops.jsx        favorites / recents
ServiceAlerts.jsx     stop + route disruptions / emergency + global notices
BusStopDisplay.jsx    live departure board + route identity + vehicle proximity
        ↓
utils/
  geo.js              Haversine distance + nearest-stop + vehicle distance
  routes.js           route indexing + WCAG-safe route text color
  maps.js             keyless privacy-conscious walking + transit URLs
  location.js         shared one-time geolocation + timeout fallback semantics
  sharedPlaces.js     validated public-stop-only share fragment codec
  time.js             timing + freshness semantics
  alerts.js           pure alert filtering
~~~

The project deliberately avoids a router, global state library, backend, map SDK, and heavy design system. Its scope is small enough that focused React hooks and browser APIs keep the architecture easier to inspect, test, and maintain.

## Reliability

- departures refresh every 30 seconds while the page is visible
- returning to the tab triggers an immediate refresh
- obsolete requests are aborted
- HTTP requests time out after 8 seconds
- same-stop data survives temporary provider failures
- cross-stop stale-data leakage is prevented
- provider payloads are normalized at the API boundary
- malformed arrivals are ignored defensively
- an expired stop catalogue remains usable while refresh is retried
- GTFS coordinate loading/failure never blocks normal name/number stop search
- geolocation is requested only from a direct user gesture
- high-accuracy geolocation timeout retries once with a lower-power cached-position strategy
- low-accuracy, far-from-network, and ambiguous opposite-direction results do not silently auto-select a stop
- walking and transit navigation are explicit external handoffs; the user's origin is not embedded in generated Maps URLs
- My Places persistence strips coordinates, distance and any other setup-only fields before writing to storage
- only public stop IDs/names are persisted for Safe Arrival Zones; exact home/school/work coordinates are not required
- Safe Arrival setup is capped at three stops and refuses clearly out-of-network location results
- Safe Place share serialization strips coordinates and accepts only Home/School/Work plus up to three numeric public stop IDs
- share links remove unrelated current-stop query state and store the payload in the URL fragment
- malformed/unsupported shared payloads are ignored and valid imports require explicit user confirmation
- service alerts refresh conservatively every five minutes while visible
- the last successful raw alert payload is re-filtered locally when the active stop, visible lines, or route metadata changes
- route-only disruptions are matched through GTFS route_id → route_short_name rather than guessed from identifiers
- empty global/emergency envelopes are ignored; a real emergency notice suppresses ordinary alert noise
- route metadata is progressive enhancement and cannot block departures
- vehicle proximity is shown only for monitored arrivals with valid WGS84 coordinates
- background tabs do not create unnecessary Föli API load
- service worker caches only same-origin application shell/assets, never `data.foli.fi` realtime responses

## Accessibility

Accessibility is a release gate, not a checklist claim.

- semantic headings, labels, table headers, status and alert regions
- accessible combobox/listbox semantics
- full keyboard autocomplete navigation
- location feedback uses status/alert semantics rather than visual-only state
- nearest-stop buttons expose stop name, number, and distance to assistive technology
- Safe Arrival setup uses native checkbox/radio semantics to distinguish allowed stops from the primary stop
- Show driver uses a labelled dialog region and does not rely on color or map interpretation
- official line colors are paired with runtime contrast correction before rendering text
- alert effect labels, route scope and expandable detail text remain available without color dependence
- walking-direction links have explicit destination-aware accessible names and keyboard focus states
- visible focus states
- `aria-busy`, `aria-live`, `aria-invalid`, and `aria-pressed`
- reduced-motion support
- forced-colors-aware styling
- touch-friendly controls
- WCAG AA color contrast verified by axe in CI

The automated audit originally found insufficient secondary-text contrast. The palette was corrected rather than suppressing the rule.

## Quality gates

Every pull request to `master` must pass:

| Gate | Coverage |
| --- | --- |
| ESLint | JavaScript/JSX correctness + React Hooks rules |
| Vitest + Testing Library | timing semantics, stale-data safety, route-aware alerts, emergency precedence, GTFS route metadata, WCAG route contrast, geolocation, Safe Arrival persistence/share privacy, explicit import semantics, stop/vehicle distance math, walking/transit Maps URL privacy, failure states |
| Production build | Vite production compilation |
| Playwright · Chromium | real DOM daily-flow + real browser geolocation permission flow |
| Playwright · Firefox | cross-browser behavior |
| Playwright · mobile WebKit | iPhone-sized layout and interaction flow |
| axe | WCAG 2 A/AA, 2.1 AA and 2.2 AA serious/critical violations |
| Mobile overflow | guards against page-level horizontal overflow |

Browser tests mock the documented Föli contracts intentionally. Provider/network incidents therefore cannot make the release pipeline flaky.

CI also retains Playwright reports, failure traces, and recruiter-ready desktop/mobile product screenshots as build artifacts.

## Stack

- React 18
- Vite 8
- Vitest 5
- Testing Library
- Playwright
- axe
- ESLint
- Axios
- CSS Modules
- browser Geolocation, History, Storage, Visibility, Service Worker, Web Share, Clipboard, and AbortController APIs
- GitHub Actions
- Föli SIRI Stop Monitoring API
- Föli GTFS stops API
- Föli GTFS routes API
- Föli service alerts API

## Run locally

~~~bash
npm ci
npm run dev
~~~

Optional compatible API overrides:

~~~bash
VITE_FOLI_API_URL=https://example.test/siri/sm npm run dev
VITE_FOLI_ALERTS_URL=https://example.test/alerts npm run dev
VITE_FOLI_STOPS_URL=https://example.test/gtfs/stops npm run dev
VITE_FOLI_ROUTES_URL=https://example.test/gtfs/routes npm run dev
~~~

Core local checks:

~~~bash
npm run lint
npm test
npm run build
~~~

Browser QA uses Playwright and axe. CI installs their pinned release tooling before running `npm run test:e2e`.

Browser geolocation requires a secure context in production. HTTPS deployment satisfies that requirement; localhost remains valid for local development.

## Data source

Source: Turku region public transport transit and timetable data, maintained by Turku region public transport and distributed through `data.foli.fi` under the Creative Commons Attribution 4.0 International license (CC BY 4.0).

Official Stop Monitoring documentation: https://data.foli.fi/doc/siri/v0/sm-en

Official GTFS stops documentation: https://data.foli.fi/doc/gtfs/v0/stops

Google Maps URLs documentation (keyless directions handoff): https://developers.google.com/maps/documentation/urls/get-started

This is an independent portfolio project and is not an official Föli application.

## License

Application source code is available under the MIT License. Föli data remains subject to its own CC BY 4.0 terms.
