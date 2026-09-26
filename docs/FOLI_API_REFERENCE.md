# Föli API engineering reference

> Last four-pass verification: **2026-09-20**  
> Product: **Föli Live Departures**  
> Provider: **Turku region public transport / data.foli.fi**  
> Purpose: a maintainer-oriented map of the provider contracts, their live behavior, the subset used by this application, and the safest expansion paths.

This document is intentionally stricter than a summary of the upstream documentation. Föli's own English documentation warns that the API is not fully stable, and several older examples no longer exactly match the current live payloads. Treat the distinction between **documented**, **live-observed**, and **application-used** fields as part of the contract.

## Verification method

Every statement that can affect implementation was checked in four passes:

1. **Official documentation** — the Föli API index, policies, GTFS, SIRI, ALERTS and GEOJSON documentation.
2. **Live API contract audit** — HTTPS requests against the current production API, including response shape, redirects, cache headers and representative field names.
3. **Application cross-check** — comparison against `src/api/foliApi.js`, hooks, alert normalization, departure rendering and release workflows.
4. **Consistency pass** — endpoint inventory and field names checked again against the current live dataset and this document.

A dated live snapshot is included below. Counts and the current GTFS dataset identifier are observations, **not permanent API guarantees**.

## Official sources

- API index: https://data.foli.fi/doc/index
- Policies: https://data.foli.fi/doc/linjaukset-en
- GTFS index: https://data.foli.fi/doc/gtfs/v0/index-en
- GTFS URL/redirect model: https://data.foli.fi/doc/gtfs/v0/redirect-en
- SIRI index: https://data.foli.fi/doc/siri/v0/index-en
- SIRI Stop Monitoring: https://data.foli.fi/doc/siri/v0/sm-en
- SIRI Vehicle Monitoring: https://data.foli.fi/doc/siri/v0/vm-en
- ALERTS: https://data.foli.fi/doc/alerts/v0/index
- GEOJSON: https://data.foli.fi/doc/geojson/v0/index
- Change log: https://data.foli.fi/doc/muutokset-en

## Provider-wide rules

| Rule | Engineering consequence |
| --- | --- |
| Public API; no registration currently required | No provider API key is needed. Do not build authentication assumptions around the current API. |
| HTTP GET only | Browser calls should remain simple GET requests. Avoid custom headers that would cause an OPTIONS preflight: the provider advertises CORS `Access-Control-Allow-Origin: *` but does not answer OPTIONS preflight requests. |
| Same URL returns the same cacheable dataset to all clients | Filtering, sorting and selection belong in the client. |
| Responses may be gzip-compressed | Use browser/fetch/Axios decompression; do not write custom content decoding. |
| Approximate rate limit: 32 requests/s per IP, burst 64 | Poll conservatively, cache static data and back off after failures. |
| Cache headers are meaningful | Respect provider cacheability. Current live TTLs differ substantially by family: VM about 1–2 s, SM catalog about 15 s, alerts a few seconds, GEOJSON about 60 s, pinned GTFS observed at 1800 s. |
| API is not promised fully stable | Normalize at the API boundary and maintain live contract smoke tests. |
| CC BY 4.0 | Product UI and repository documentation must preserve source attribution. |
| GTFS and SIRI come from different systems | Do not assume identifiers such as SIRI `blockref` always equal GTFS `block_id`. Correlate defensively. |
| Sorting is not guaranteed unless explicitly documented | Sort in the client whenever order matters. |

### HTTPS note

Old provider policy text prefers plain HTTP to reduce handshake overhead. This application intentionally uses **HTTPS** because it runs in a browser, geolocation requires a secure context in production, and mixed-content HTTP requests from an HTTPS app are not acceptable.

---

# Endpoint inventory

## 1. GTFS — static/planned transit data

### URL model and the trailing-slash compatibility trap

The provider uses short/latest URLs plus dataset-specific URLs.

**Recommended application flow:**

```text
GET https://data.foli.fi/gtfs/
        ↓
{ host, gtfspath, latest, datasets, subpaths, ... }
        ↓
https://data.foli.fi/gtfs/v0/<latest>/<resource>
```

As verified on **2026-09-20**:

| URL | Live behavior |
| --- | --- |
| `/gtfs` | **404 over current HTTPS runtime** |
| `/gtfs/` | 200 metadata JSON |
| `/gtfs/v0` | 200 metadata JSON |
| `/gtfs/v0/` | 200 metadata JSON |
| `/gtfs/stops` | works and redirects/follows through to the current dataset |
| `/gtfs/routes` | works and redirects/follows through to the current dataset |

The historical documentation shows `/gtfs` without a trailing slash. Do **not** copy that literal into this application's default metadata URL. The application uses `https://data.foli.fi/gtfs/`.

### GTFS metadata

**Endpoint**

```text
GET /gtfs/
GET /gtfs/v0
GET /gtfs/v0/
```

**Current response shape**

```text
object {
  host,
  gtfspath,
  datasets[],
  latest,
  success,
  subpaths[]
}
```

Current live `subpaths` observed:

```text
agency
stops
routes
trips
trip_notes
translations
stop_times
calendar
calendar_dates
shapes
```

**Application use:** ✅ **Yes.** The app resolves `latest` once and then requests `stops` and `routes` from the same dataset. This prevents the rare race where a new GTFS package is published between two related requests.

### Latest package archive

```text
GET /gtfs/gtfs.zip
```

Complete GTFS package. Useful for offline/server-side preprocessing. Not suitable as the normal browser path for this product.

**Application use:** ❌ No.

---

## 1.1 `agency`

```text
GET /gtfs/agency
GET /gtfs/v0/<dataset>/agency
```

**Shape:** array of agency objects.

Live fields:

| Field | Meaning |
| --- | --- |
| `agency_id` | Agency identifier |
| `agency_name` | Display name |
| `agency_url` | Agency website |
| `agency_timezone` | Time zone, currently Europe/Helsinki in normal Föli data |
| `agency_lang` | Agency language |
| `agency_phone` | Contact phone |
| `agency_fare_url` | Fare information URL, may be empty |

**Application use:** ❌ No.  
**Potential value:** low for the departure board; medium for agency attribution or multi-operator detail.

---

## 1.2 `stops`

```text
GET /gtfs/stops
GET /gtfs/v0/<dataset>/stops
```

**Shape:** object keyed by GTFS `stop_id`.

Live fields observed:

| Field | Meaning | Used by us |
| --- | --- | --- |
| object key / `stop_id` | GTFS stop identifier | ✅ identity |
| `stop_code` | Public-facing stop code where populated | ❌ |
| `stop_name` | Stop name | only SIRI catalog name is currently used for search; GTFS name is not persisted from this response |
| `stop_desc` | Description | ❌ |
| `stop_lat` | WGS84 latitude | ✅ nearest-stop / Maps / vehicle distance |
| `stop_lon` | WGS84 longitude | ✅ |
| `zone_id` | Fare/zone identifier | ❌ |
| `stop_url` | Stop URL | ❌ |
| `location_type` | GTFS location type | ❌ |
| `parent_station` | Parent station relation | ❌ |
| `stop_timezone` | Stop timezone | ❌ |
| `wheelchair_boarding` | Accessibility/boarding flag | ❌ |

**Application use:** ✅ **Yes, only coordinates.**

**Good future candidates**
- `wheelchair_boarding` for accessible stop filtering/labels.
- `parent_station` / `location_type` if station/platform grouping becomes important.
- `stop_code` should not be assumed equal to `stop_id` forever just because historical Föli data often aligned them.

---

## 1.3 `routes`

```text
GET /gtfs/routes
GET /gtfs/v0/<dataset>/routes
```

**Shape:** array.

Live fields:

| Field | Meaning | Used by us |
| --- | --- | --- |
| `route_id` | GTFS route identity | ✅ map alerts to line metadata |
| `agency_id` | Agency | ❌ |
| `route_short_name` | Public line name/number | ✅ |
| `route_long_name` | Human-readable route description | ✅ tooltip/context |
| `route_desc` | Extra description | ❌ |
| `route_type` | GTFS transport mode | ✅ distinguish waterbus vs bus in proximity copy |
| `route_url` | Route URL | ❌ |
| `route_color` | Provider route color, six-digit hex without `#` | ✅ |
| `route_text_color` | Provider preferred text color | ✅, but corrected if contrast is insufficient |

**Application use:** ✅ **Yes.**

---

## 1.4 `calendar`

```text
GET /gtfs/calendar
GET /gtfs/v0/<dataset>/calendar
```

**Shape:** object keyed by `service_id`.

Live value fields:

```text
monday
tuesday
wednesday
thursday
friday
saturday
sunday
start_date
end_date
```

**Important upstream-doc drift:** the old English Föli page says `calendar.txt` was not used and that all service was expressed through exceptions. The 2026 live dataset contains hundreds of populated calendar service records. Treat the old statement as historical, not current behavior.

**Application use:** ❌ No.

---

## 1.5 `calendar_dates`

```text
GET /gtfs/calendar_dates
GET /gtfs/v0/<dataset>/calendar_dates
```

**Shape:** object keyed by `service_id`; each value is an array.

Item fields:

| Field | Meaning |
| --- | --- |
| `date` | Service date in `YYYYMMDD` |
| `exception_type` | GTFS service exception type |

Live sample verified on 2026-09-20:

```json
{"date":"20260810","exception_type":1}
```

Do not hard-code the assumption that only one exception value occurs.

**Application use:** ❌ No.

---

## 1.6 `trips`

The base `trips` path is a metadata/subpath dispatcher rather than the whole table.

```text
GET /gtfs/trips
GET /gtfs/v0/<dataset>/trips
```

Current subviews:

```text
/trips/all
/trips/route/<route_id>
/trips/service/<service_id>
/trips/trip/<trip_id>
```

### `/trips/all`

**Shape:** large array of every current planned trip.

Current fields:

```text
route_id
service_id
trip_id
trip_headsign
direction_id
block_id
shape_id
wheelchair_accessible
bikes_allowed
```

The upstream documentation warns this is a large response. Prefer narrow views or server-side preprocessing in a browser product.

### `/trips/route/<route_id>`

Trips belonging to a route. The route is already known, so current rows omit `route_id` but retain:

```text
service_id
trip_id
trip_headsign
direction_id
block_id
shape_id
wheelchair_accessible
bikes_allowed
```

### `/trips/service/<service_id>`

Trips belonging to one service. Current rows include `route_id` and omit the already-known `service_id`.

### `/trips/trip/<trip_id>`

**Shape:** array containing the matching trip (normally one item). Current row omits the already-known `trip_id` and includes route/service/headsign/direction/block/shape/accessibility/bike fields.

**Application use:** ✅ **Partial, progressive enrichment.** Visible realtime rows can use a matching `__tripref` to fetch one trip record for `trip_headsign` and `wheelchair_accessible`; failure never blocks departures.

**High-value relationship use:** ★★★★★  
Together with `stop_times`, this is the cleanest static-data route to determine **all routes normally serving a selected stop**, rather than only routes that happen to have a visible realtime departure. That would close the remaining route-level ALERTS coverage gap.

---

## 1.7 `stop_times`

Base endpoint exposes subpaths:

```text
GET /gtfs/stop_times
GET /gtfs/v0/<dataset>/stop_times
```

### Identifier indexes

```text
GET /stop_times/stop
→ array of stop_id strings

GET /stop_times/trip
→ array of trip_id strings
```

### Timetable by stop

```text
GET /stop_times/stop/<stop_id>
```

The provider documents this view as ordered by planned arrival.

Current row fields:

```text
trip_id
arrival_time
departure_time
stop_sequence
stop_headsign
pickup_type
drop_off_type
shape_dist_traveled
timepoint
```

### Stop sequence by trip

```text
GET /stop_times/trip/<trip_id>
```

Current row fields:

```text
arrival_time
departure_time
stop_id
stop_sequence
stop_headsign
pickup_type
drop_off_type
shape_dist_traveled
timepoint
```

**Application use:** ✅ **Yes, selectively.** `/stop_times/stop/<stop_id>` participates in complete route-alert membership and excludes `pickup_type=1`, and feeds the timetable fallback when SIRI has nothing ahead. `/stop_times/trip/<trip_id>` is loaded only when the user expands “Next stops” or opens a get-off setup; on a loop that visits the stop twice, the departure's planned time picks the pass being boarded, and `drop_off_type=1` stops are not offered as exits. `timepoint=0` is presented as an approximate planned time.

**Remaining future value:** planned fallback information beyond the current journey-detail flow.

---

## 1.8 `shapes`

```text
GET /gtfs/shapes
→ array of shape_id strings

GET /gtfs/shapes/<shape_id>
→ ordered coordinate array
```

Coordinate item:

```text
lat       WGS84 latitude
lon       WGS84 longitude
traveled  cumulative shape distance
```

A shape belongs to a **trip**, not inherently to a line; trips on the same route can legally use different shapes.

**Application use:** ✅ **Ride Mode only.** The boarded trip's own `shape_id` (from `/trips/trip/<trip_id>`) is loaded when location backup is on, and the phone's position is map-matched to it for along-route distance to the exit stop. The documentation gives `traveled` no unit while Ride Mode's thresholds are in metres, so a shape is used only when its `traveled` total agrees with the drawn path's length to within a factor of two; otherwise the ride falls back to straight-line distance and SIRI.  
**Future value:** medium/high if a route map or detour visualization is added. Do not select a route shape by blindly taking the first trip if correctness matters.

---

## 1.9 `trip_notes` — live Föli extension

Current metadata advertises this subpath even though the older English GTFS index does not.

```text
GET /gtfs/trip_notes
GET /gtfs/v0/<dataset>/trip_notes
```

**Shape:** object keyed by `trip_id`; value is an array of localized notes.

Live item fields:

```text
abbreviation
description
lang
```

Example semantics observed:

```text
fi: Pe → Perjantaisin
sv: Pe → På fredagar
en: Pe → On Fridays
```

**Application use:** ❌ No.  
**Status:** provider extension / live-observed contract; do not confuse with a core GTFS table that every GTFS feed must expose.

---

## 1.10 `translations` — current GTFS translation table

Current live metadata advertises:

```text
GET /gtfs/translations
GET /gtfs/v0/<dataset>/translations
```

**Shape:** array.

Live fields:

```text
table_name
field_name
language
translation
record_id
field_value
```

Live examples include Swedish stop-name translations.

**Application use:** ❌ No.  
**Future value:** high if the entire app becomes language-aware beyond ALERTS.

---

# 2. SIRI — realtime information

Föli exposes two SIRI-derived services:

- **SM — Stop Monitoring:** departures/arrivals around a stop.
- **VM — Vehicle Monitoring:** system-wide active vehicle state.

Föli explicitly warns that GTFS and SIRI are produced by different systems and can occasionally disagree.

## 2.1 Stop catalogue

```text
GET /siri/sm
```

**Shape:** object keyed by active public stop identifier.

Value currently contains:

```text
stop_name
```

Current live response cache observed: approximately **15 s**.

**Application use:** ✅ **Core.**
- stop name/number search
- canonical human stop name
- active stop catalogue independent from GTFS coordinates

This endpoint is deliberately allowed to succeed even if GTFS enrichment fails.

---

## 2.2 Stop Monitoring by stop

```text
GET /siri/sm/<stop_id>
```

**Top-level live shape**

```text
{
  sys: "SM",
  status: "OK" | "NO_SIRI_DATA",
  servertime: Unix seconds,
  result: [...]
}
```

The live response verified on 2026-09-20 did **not** contain a guaranteed top-level `stopname`. The application therefore prefers the name from the `/siri/sm` catalogue and treats any stop-specific `stopname` as optional compatibility data.

### Live result fields and our use

| Field | Semantics | App |
| --- | --- | --- |
| `lineref` | Public line reference used by SIRI | ✅ line badge / route lookup |
| `destinationdisplay` | Destination/front-display text | ✅ |
| `destinationdisplay_en` | English destination variant | ✅ shown beside the sign text for English readers, never instead of it |
| `destinationdisplay_sv` | Swedish destination variant | ✅ shown beside the sign text for Swedish readers, never instead of it |
| `monitored` | Realtime monitoring available | ✅ realtime vs scheduled semantics |
| `delay` | Delay value supplied by current JSON adapter | ✅ |
| `recordedattime` | Vehicle observation time | ✅ freshness |
| `latitude`, `longitude` | Provider-estimated vehicle location, WGS84 | ✅ straight-line vehicle/stop proximity |
| `originaimeddeparturetime` | Planned departure at trip origin | ✅ Ride Mode identity (with `lineref`, or to tell apart two runs of one vehicle) |
| `destinationaimedarrivaltime` | Planned arrival at final destination | ✅ retained |
| `aimedarrivaltime` | Planned arrival at selected stop | ✅ time fallback |
| `expectedarrivaltime` | Estimated arrival at selected stop | ✅ time fallback |
| `aimeddeparturetime` | Planned departure at selected stop | ✅ time fallback |
| `expecteddeparturetime` | Estimated departure at selected stop | ✅ preferred due time |
| `vehicleatstop` | Provider says vehicle is at stop | ✅ preferred over distance inference when fresh |
| `vehicleref` | Vehicle identifier | ✅ Ride Mode identity fallback; a bus listed twice (two runs) is told apart by origin time |
| `incongestion` | Congestion flag | ❌ candidate, semantics should remain provider-attributed |
| `directionname` | Direction label | ❌ |
| `destinationref` | Destination stop/reference | ❌ |
| `originref` | Origin reference | ❌ |
| `visitnumber` | Visit sequence/reference | ❌ not relied on; a loop's two visits are told apart by planned time instead |
| `blockref` | SIRI block reference | ❌; do not assume perfect GTFS block match |
| `dataframeref` | SIRI data frame identity | ❌ |
| `datedvehiclejourneyref` | SIRI journey identity | ✅ Ride Mode's strongest identity for the boarded journey |
| `__directionid` | Provider adapter/internal helper field observed live | ❌ do not depend on undocumented `__*` fields |
| `__routeref` | Provider adapter/internal route helper observed live | ❌ do not make a hard contract |
| `__tripref` | Provider adapter/internal trip helper observed live | ✅ optional enrichment key only; never required for core departures |

### Time choice in this app

For the departure board:

```text
expecteddeparturetime
→ expectedarrivaltime
→ aimeddeparturetime
→ aimedarrivaltime
```

Rows without any usable timestamp are dropped.

### Stop Monitoring utility suffixes

```text
GET /siri/sm/<stop_id>/pretty
GET /siri/sm/<stop_id>/format
GET /siri/sm/<stop_id>/xml
```

- `pretty`: same JSON, human-formatted.
- `format`: timestamp values converted to readable time strings; debugging only.
- `xml`: original SIRI XML; live content type observed as `text/xml; charset=iso-8859-1`.

**Application use:** compact JSON only.

---

## 2.3 Vehicle Monitoring

```text
GET /siri/vm
GET /siri/vm/pretty
```

VM returns all currently known active vehicles; Föli does not provide a server-side “only these vehicles” filter. The official docs warn that the payload is large and should not be aggressively polled on handhelds. Polling faster than about 3 seconds is not useful; provider caching is around 1–2 seconds.

**Top-level**

```text
{
  sys: "VM",
  status: "PENDING" | "OK" | "NO_SIRI_DATA",
  servertime,
  result: {
    responsetimestamp,
    producerref,
    responsemessageidentifier,
    status,
    moredata,
    vehicles: {
      "<vehicle id>": { ... }
    }
  }
}
```

### Current live vehicle fields

```text
__directionid
__routeref
__tripref
blockref
delay
delaysecs
destinationaimedarrivaltime
destinationname
destinationname_sv
destinationref
directionref
incongestion
inpanic
latitude
lineref
linkdistance
longitude
monitored
next_aimedarrivaltime
next_aimeddeparturetime
next_destinationdisplay
next_destinationdisplay_sv
next_expectedarrivaltime
next_expecteddeparturetime
next_stoppointname
next_stoppointname_sv
next_stoppointref
next_visitnumber
onwardcalls
operatorref
originaimeddeparturetime
originname
originname_sv
originref
percentage
publishedlinename
recordedattime
validuntiltime
vehicleatstop
vehicleref
```

The official VM documentation also defines `previouscalls[]`; the audited current vehicle sample did not carry a populated `previouscalls` key. Clients should therefore treat both previous/onward call collections as optional.

Current `onwardcalls[]` fields observed:

```text
aimedarrivaltime
aimeddeparturetime
expectedarrivaltime
expecteddeparturetime
stoppointname
stoppointname_sv
stoppointref
visitnumber
```

### Reliability warning

Vehicle location is **not raw GPS truth**. Föli documents it as a backend estimate using GPS/odometer/time and constraining the vehicle to its planned route. A vehicle forced onto an unplanned detour can therefore be misplaced or lost by the positioning model.

**Application use:** ❌ No.  
**Decision:** keep it unused until a user-facing fleet/map feature justifies the bandwidth and complexity. Stop Monitoring already gives enough position data for the current “vehicle distance from selected stop” feature.

---

# 3. ALERTS — disruptions, notices and cancellations

## Endpoints

```text
GET /alerts
GET /alerts/messages
GET /alerts/cancellations
GET /alerts/categories
```

Current live caching observed:
- `/alerts`, messages/cancellations: about a few seconds
- `/alerts/categories`: about two minutes

The app deliberately polls much more conservatively (five minutes) because disruptions do not require second-level refresh and the product should minimize provider load.

## 3.1 `/alerts`

**Shape**

```text
{
  servertime,
  global_message,
  emergency_message,
  cancellations[],
  messages[]
}
```

### Envelope fields

| Field | Meaning | App |
| --- | --- | --- |
| `servertime` | Provider generation timestamp | raw payload retained, not currently surfaced |
| `global_message` | General message in addition to normal messages | ✅ |
| `emergency_message` | Emergency content intended to replace ordinary messages | ✅ suppresses lower-priority content |
| `cancellations` | Cancelled trips/departures | ✅ selected-stop active rows |
| `messages` | Notices/disruptions | ✅ |

### Message fields

Live current message fields:

```text
message_id
icon
cause
effect
header
message
information
translations
images
repeat
isactive
priority
categories
affected_routes
affected_stops
channel_web
channel_stops
channel_gtfsrt
channel_mobile
channel_ticker
```

Field behavior:

| Field | Meaning | App |
| --- | --- | --- |
| `message_id` | Provider message identity | ✅ stable normalized key when present |
| `header` | Heading; upstream docs say max 64 chars | ✅ |
| `message` | Core standalone message; upstream docs say max 300 chars | ✅ |
| `information` | Longer supplementary text; may contain links/newlines | ✅ collapsed details |
| `translations` | Locale-specific header/message/information, e.g. `en_GB`, `sv_FI` | ✅ browser-language matching with per-field fallback |
| `icon` | Suggested BUS/BOAT/BIKE/NONE-style icon code | normalized but not currently rendered |
| `cause` | GTFS-RT-style cause | retained; shown for cancellations, not normal messages |
| `effect` | GTFS-RT-style effect | ✅ user-facing semantic badge |
| `images` | Related media objects `{url,type,title}` | ✅ HTTPS-only; mounted only after explicit details expansion |
| `repeat` | Active time ranges `[[start,end], ...]` | ✅ active validity window is surfaced when an end time is available |
| `isactive` | Whether message should currently be shown | ✅ mandatory filter |
| `priority` | Smaller number = more important | ✅ sorting |
| `categories` | Message category tags | ❌ |
| `affected_routes` | GTFS `route_id` list | ✅ route mapping, with a known completeness limitation |
| `affected_stops` | GTFS `stop_id` list | ✅ direct selected-stop match |
| `channel_*` | Provider channel targeting metadata | ❌ |

Documented effect values:

```text
NO_SERVICE
REDUCED_SERVICE
SIGNIFICANT_DELAYS
DETOUR
ADDITIONAL_SERVICE
MODIFIED_SERVICE
OTHER_EFFECT
UNKNOWN_EFFECT
STOP_MOVED
```

Documented cause values:

```text
UNKNOWN_CAUSE
OTHER_CAUSE
TECHNICAL_PROBLEM
STRIKE
DEMONSTRATION
ACCIDENT
HOLIDAY
WEATHER
MAINTENANCE
CONSTRUCTION
POLICE_ACTIVITY
MEDICAL_EMERGENCY
```

### Route-level alert completeness

Route-only disruptions are no longer limited to lines visible in the current SIRI board. The app first keeps the cheap realtime match, then progressively checks only still-unmatched `affected_routes` against the pinned GTFS dataset:

```text
selected stop
→ stop_times/stop/<stop_id>
→ boardable trip_id set (pickup_type != 1)
+
affected route_id
→ trips/route/<route_id>
→ trip_id set
→ intersection
→ ALERTS affected_routes
```

The relation lookups are cached for the page session and fetched in small batches. Failure falls back to the existing realtime-line match, so disruption enrichment cannot break core departures.

This is **static membership**, not a claim that a specific scheduled trip is running now. The alert itself must still be active according to Föli.

## 3.2 Cancellations

A cancellation includes:

```text
icon
line
cause
priority
departure
stops[]
```

Each stop entry:

```text
stop
arrival
isactive
```

The provider documents `isactive` as becoming true around ten minutes before the theoretical stop arrival and false around five minutes after passage.

**Application use:** ✅ line, cause, active matching stop and its scheduled arrival. Besides the Service updates entry, a board row whose line matches and whose planned arrival is within 90 s of the cancelled stop's `arrival` is shown as cancelled, with no countdown and no get-off alert.  
**Unused:** cancellation-level departure, priority override and icon.

## 3.3 `/alerts/messages`

Returns message-focused envelope:

```text
servertime
global_message
emergency_message
messages
```

**Application use:** ❌ We use the combined `/alerts` endpoint so cancellations and messages share one refresh.

## 3.4 `/alerts/cancellations`

Returns the cancellation array directly.

**Application use:** ❌ separate endpoint not needed because combined `/alerts` is used.

## 3.5 `/alerts/categories`

**Shape:** array.

Live fields:

```text
catid
category
descr_fi
descr_sv
descr_en
```

**Application use:** ❌ No.  
**Future value:** medium for readable category chips/filtering; not required for basic disruption awareness.

## 3.6 Alert image URLs

Messages can include `images[]` with protocol-relative provider URLs. Treat them as provider media assets, normalize to HTTPS before rendering, validate content type, and never inject provider `information` as raw HTML.

**Application use:** ✅ Yes. Provider image URLs are normalized to HTTPS and media is mounted only after the user explicitly expands disruption details. Raw provider `information` remains text rather than injected HTML.

---

# 4. GEOJSON — service POIs and Föli region geometry

## 4.1 Layer discovery

```text
GET /geojson/layers
```

**Shape**

```text
{
  geojson: {
    layers: [
      {
        name: { fi, sv, en },
        url,
        metadata: {
          name,
          popupContent,
          textOnly
        }
      }
    ]
  }
}
```

Do not hard-code the layer list as permanent. Discover it when building a generic POI feature.

Current live advertised layers on 2026-09-20:

```text
/geojson/poi/service_points
/geojson/poi/loading_points
/geojson/poi/ticket_machines
/geojson/poi/other
```

## 4.2 All POIs

```text
GET /geojson/poi
```

**Shape:** GeoJSON `FeatureCollection`.

## 4.3 POI layer endpoints

Each current layer returns a GeoJSON `FeatureCollection` of `Point` features.

Feature:

```text
{
  type: "Feature",
  id,
  geometry: {
    type: "Point",
    coordinates: [longitude, latitude]
  },
  properties: { ... }
}
```

Common live properties:

```text
category
name
name_fi
name_sv
name_en
address
address_fi
address_sv
city
city_fi
city_sv
popup
text
icon
```

`icon` can contain:

```text
id
svg
```

Provider note: SVG content may be supplied only on the first occurrence of an icon ID; later features can reference the ID without repeating SVG.

**Application use:** ❌ No.

Potential product uses:
- ticket-machine discovery
- Föli service-office fallback
- travel-help/support destinations

Do not add these to the core departure screen unless user research shows demand.

## 4.4 Föli region boundary

```text
GET /geojson/bounds
GET /geojson/bounds/ml

GET /geojson/bounds/strict
GET /geojson/bounds/strict/ml

GET /geojson/bounds/compact
GET /geojson/bounds/compact/ml
```

Normal endpoints return a GeoJSON `FeatureCollection`.

- no suffix: `MultiPolygon`
- `/ml`: `MultiLineString`

Common feature properties:

```text
name
name_fi
name_sv
name_en
```

Provider-documented trade-off:
- `strict`: roughly 4500 points / ~90 KiB
- default: roughly 900 points / ~20 KiB
- `compact`: roughly 400 points / ~8 KiB and specifically recommended for mobile

**Application use:** ✅ **Yes.** `/geojson/bounds/compact` is cached locally and checked client-side before automatic nearest-stop selection and location-based Safe Place setup. If it is unavailable, the existing conservative distance/accuracy logic remains the fallback.

**Value:** ★★★★★. `/geojson/bounds/compact` is a better “are you inside the Föli region?” signal than a simple distance-to-nearest-stop threshold. If adopted, keep distance as a secondary sanity check rather than the sole service-area heuristic.

---

# What the application uses today

## Endpoint-level comparison

| Endpoint/data | Current use | Importance |
| --- | --- | ---: |
| `/siri/sm` | stop ID/name catalogue and search | Core |
| `/siri/sm/<stop_id>` | departures, realtime/planned times, delay, vehicle freshness and coordinates | Core |
| `/gtfs/` | resolve one coherent current dataset | Supporting correctness |
| pinned `/stops` | stop WGS84 coordinates | Feature-critical for nearby/recovery |
| pinned `/routes` | route ID/name/type/color metadata | Important enrichment |
| `/alerts` | global/emergency messages, stop/route messages, cancellations (also marked on board rows) | Core pre-trip context |
| `/siri/vm` | unused | Not justified yet |
| `trips` | trip-specific accessibility/headsign enrichment + route membership lookups | High-value progressive enrichment |
| `stop_times` | boardable stop→trip membership, timetable fallback, lazy next-stop sequence, Ride Mode trip plan | High-value correctness and journey context |
| `shapes` | Ride Mode GPS map matching for the boarded trip, when metre-scaled | Get-off accuracy |
| `calendar*` | unused | Future planned-service logic |
| `trip_notes` | unused | Optional timetable semantics |
| `translations` | unused | Future app-wide localization |
| `/alerts/categories` | unused | Optional UX enrichment |
| alert images/channels | images used on explicit expansion; channel flags remain unused | High for detours/stop moves |
| `/geojson/bounds/compact` | client-side service-area validation for geolocation flows | High-value location correctness |
| GEOJSON POIs | unused | Optional support/travel-help feature |

## Data minimization is intentional

Not using every available field is a feature, not a deficiency. For every provider field added to product state, ask:

1. Does this materially improve a user decision?
2. Is its semantics stable/documented enough to make a claim in the UI?
3. Can it become stale independently?
4. Does it increase network or memory cost?
5. Does it create a new privacy implication?
6. Can the product degrade safely if it disappears?

---

# Recommended next API-driven improvements

## P0 — keep the provider boundary correct

1. Keep `/gtfs/` (trailing slash) covered by the live contract smoke.
2. Keep SIRI stop names independent from GTFS enrichment.
3. Never rely on optional stop-specific `stopname`; use the SM catalogue name.
4. Preserve outage backoff and visible-tab-only realtime polling.
5. Continue treating provider timestamps and vehicle coordinates as estimates.

## Implemented high-value safeguards

- route-only ALERTS use progressive static stop/route membership without downloading `trips/all`
- `/geojson/bounds/compact` is checked locally before automatic geolocation decisions
- fresh `vehicleatstop` truth is preferred before distance heuristics
- the board leads with `destinationdisplay`, the name on the bus's sign; `destinationdisplay_en` / `destinationdisplay_sv` are added beside it in the reader's language, and stand in only when the sign text is missing
- `__tripref` is accepted only as optional enrichment; core departures never depend on it
- trip-specific `wheelchair_accessible` is shown only for explicit values
- `stop_times/trip` powers lazy “Next stops”; `timepoint=0` is labelled approximate
- when SIRI has nothing ahead and the GTFS timetable fallback cannot be read, the board says the timetable went unchecked rather than "No upcoming departures"; a trip whose metadata cannot be fetched ends the timetable list there, with a note, instead of being skipped as if it did not run
- "No upcoming departures" needs an answer that itself listed nothing, with the timetable checked: a saved board whose buses have all left shows loading or a load failure instead, and when the last listed bus leaves, the board asks again at once rather than waiting for the next poll
- a cancelled request (switching stops mid-lookup) ends the answer as cancelled; it is never reported as a failed update or an unchecked timetable
- `pickup_type=1` is excluded from boarding-route membership
- ALERTS media and validity are surfaced conservatively

## Remaining candidates

- `incongestion`: consider only with clear provider-attributed wording and proven live coverage
- `platform_code`: progressive enhancement for the small subset of stops where it is populated
- GEOJSON service/ticket POIs: potentially valuable support flow, but not core departure information
- Vehicle Monitoring: justify bandwidth with a concrete user problem before adding a fleet/map feature

Do **not** present `__tripref`, `__routeref` or other double-underscore fields as stable public contracts without a fallback.

---

# Live audit snapshot — 2026-09-20

This section is diagnostic only; counts will change.

Current GTFS dataset resolved during the audit:

```text
20260916-095329
```

Observed approximate snapshot:

| Data | Live count/observation |
| --- | ---: |
| agencies | 18 |
| stops | 3575 |
| routes | 156 |
| calendar service IDs | 799 |
| calendar_dates service IDs | 799 |
| trips/all | 12417 |
| stop_times stop IDs | 3575 |
| stop_times trip IDs | 12417 |
| shapes | 426 |
| trip_notes trip IDs | 608 |
| translations | 1941 |
| VM vehicles at audit instant | 120 |
| ALERTS messages at audit instant | 21 |
| ALERTS cancellations at audit instant | 0 |
| ALERTS categories | 12 |

Other verified live characteristics:
- `wheelchair_boarding` was `0` (unknown) for all 3575 audited stops, so the app does not make stop-level accessibility claims from it
- `wheelchair_accessible` had an explicit yes/no value for 12,216 of 12,417 audited trips; this supports trip-level accessibility enrichment
- `bikes_allowed` was `0` (unknown) for all 12,417 audited trips, so the app does not show a bike-access claim
- `pickup_type=1` appeared in 14,196 of 549,037 audited stop-time rows and is treated as no boarding for route membership
- `timepoint=0` appeared in 461,843 stop-time rows and is surfaced as approximate planned time rather than exact
- a 40-stop SIRI sample exposed `vehicleatstop` on every sampled arrival and `destinationdisplay_sv` on most sampled rows; English destination coverage was materially lower, so fallback remains mandatory
- at the audit instant, 13 of 15 active ALERTS messages contained images, supporting explicit on-demand disruption media
- current GTFS metadata advertises `trip_notes` and `translations`
- current `calendar` is populated despite historical docs claiming it could be ignored
- live `/gtfs` without trailing slash returned 404 while `/gtfs/` and `/gtfs/v0` returned metadata
- SM stop-specific payload currently exposes language variants and several provider/internal helper fields not described by the old field list
- ALERTS currently exposes channel flags and message IDs in addition to the documented display semantics
- GEOJSON layer discovery should be treated as dynamic rather than freezing today's four layer names into application logic

---

# Provider/documentation discrepancies we deliberately account for

| Upstream documentation/history | Live reality verified 2026-09-20 | Rule for this app |
| --- | --- | --- |
| Examples use `/gtfs` as dataset metadata URL | HTTPS `/gtfs` returned 404; `/gtfs/` works | Use and smoke-test `/gtfs/` |
| Old calendar page says calendar is effectively unused | live calendar has many populated weekly service records | Treat calendar as valid current data |
| Older English GTFS index omits `trip_notes` and `translations` | current metadata advertises both | Document as live extensions/current subpaths |
| Old trip examples lack `bikes_allowed` | current trips expose it | Normalize only if/when product uses it |
| Old stop_times examples lack `timepoint` | current rows expose it | Treat as available but optional |
| Old stops example lacks `wheelchair_boarding` | current stops expose it | Candidate accessibility enrichment |
| SM docs list a smaller public field set | live JSON includes language variants, journey refs and `__*` helpers | Depend only on stable fields needed by product |
| Stop-specific SM is sometimes assumed to carry a stop name | current live sample did not guarantee top-level `stopname` | use `/siri/sm` catalogue as canonical stop-name source |
| API index says “five data sources” but lists GTFS, SIRI, ALERTS and GEOJSON | four families are actually listed | Do not invent a fifth family |

---

# Maintenance checklist

When changing the provider integration:

1. Read this file first.
2. Keep all production Föli URLs behind `src/api/foliApi.js` or a dedicated provider module.
3. Validate response container shape before mapping fields.
4. Treat live-only fields not present in official docs as optional.
5. Keep GTFS requests from the same feature on one dataset ID when coherence matters.
6. Never infer movement direction only from SIRI vehicle distance.
7. Never turn provider estimated times into guaranteed-language UI.
8. For ALERTS, honor `emergency_message`, `isactive`, priority and user-language translations.
9. Preserve explicit stale/error states; do not silently reuse stale provider data as fresh.
10. Update this file when an endpoint or normalized field changes.
11. Update the scheduled live contract smoke when a relied-upon provider contract changes.
12. Re-check the official policy, GTFS/SIRI/ALERTS/GEOJSON pages before a major transport-data refactor.

## Attribution

Source data: Turku region public transport transit and timetable data, maintained by Turku region public transport and distributed through `data.foli.fi` under **Creative Commons Attribution 4.0 International (CC BY 4.0)**.

This repository and application are independent and are not an official Föli application.
