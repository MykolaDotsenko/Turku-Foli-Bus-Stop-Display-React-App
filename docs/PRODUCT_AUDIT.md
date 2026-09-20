# Skeptical Product Audit

**Date:** 2026-09-20  
**Scope:** product usefulness, safety semantics, information architecture, mobile UX, accessibility, privacy, realtime correctness, resilience, PWA behavior, testing, and portfolio presentation.

This audit treats every optimistic product claim as something that should survive an adversarial question:

> What happens when the user is stressed, offline, on a small phone, using stale provider data, unable to pronounce Finnish, or relying on a feature that partially fails?

## Current assessment

| Area | Score | Why |
| --- | ---: | --- |
| Everyday user utility | **97/100** | Search, realtime board, disruptions, nearest stops, Safe Places, walking/transit handoffs and recovery cover the main daily flow without an account. |
| Reliability / failure states | **98/100** | Realtime and alert freshness now age across outages, same-stop fallbacks remain explicit, offline PWA behavior is tested, and dead-phone preparation has a physical fallback. |
| Privacy | **99/100** | Exact Home/School/Work coordinates are not persisted; Safe Places store public stop identity; shared places use public-stop-only URL fragments; no tracking backend exists. |
| Accessibility | **98/100** | Keyboard search, semantic controls, forced-colors/reduced-motion support, large touch targets and axe gates are present. |
| Mobile UX | **97/100** | Core controls collapse well, recovery is prominent, management is deprioritized, and worst-case expanded states are overflow-tested. |
| Realtime semantics | **98/100** | Live/scheduled/freshness distinctions are defensive, stale provider time advances across failed refreshes, old rows are removed, and vehicle direction is deliberately not inferred from coordinates alone. |
| PWA / degraded use | **98/100** | The complete production shell is precached and offline-reload tested; capability loss is explicit, external routes are withheld offline, and a printable Home card covers the limit where the device itself dies. |
| Portfolio / recruiter signal | **95/100** | The code demonstrates product reasoning, browser APIs, accessibility, API normalization and cross-browser QA. Repository/deployment branding metadata still needs final cleanup. |

These are implementation-quality scores, not claims of market validation.

## High-ROI issues fixed in this audit

### 1. Core value was too far down the page

**Problem:** Near you and the relatively large My Places management surface appeared before the live departure board.

**Risk:** a commuter opening the product for its primary job — “what leaves now?” — had to scan or scroll through setup/management UI first.

**Change:** normal information hierarchy now prioritizes:

1. Get me Home recovery, when configured
2. stop search
3. near-you shortcut
4. favorites / recents
5. relevant service disruptions
6. **live departures**
7. My Places management

A shared Safe Place is the exception: explicit import confirmation moves up because that is the user's current task.

### 2. “Bus approaching” claimed more than the data proved

**Problem:** a vehicle within 250 m was labelled “approaching”.

**Risk:** latitude/longitude plus distance cannot prove travel direction. The vehicle may have passed the stop, be on a loop, or report a delayed position.

**Change:** the product now says **Bus nearby** and retains the straight-line distance. Stale coordinates continue to be labelled as an old last position.

### 3. Old departures could remain as “Due”

**Problem:** provider rows with a past timestamp could be clamped by the UI to Due.

**Risk:** users could wait for a vehicle that has already left.

**Change:** departures older than a short grace interval are removed before rendering. Rows without any valid departure timestamp are not presented as useful departures.

### 4. Backup Safe Arrival stops were trusted automatically

**Problem:** initial Safe Place setup preselected all three nearest stops.

**Risk:** physical proximity does not make a stop safe, appropriate, or even useful for the correct side/direction. For a child, auto-approving backups is too strong an assumption.

**Change:** only the nearest candidate is initially selected. Backup stops require explicit opt-in and explanatory copy.

### 5. More than four alerts were silently hidden

**Problem:** the UI rendered only the first four relevant alerts without explaining that additional alerts existed.

**Risk:** a lower-priority but still relevant disruption could be invisible.

**Change:** the first four remain the low-noise default, but the UI exposes “Show N more updates” with accessible expanded state.

### 6. Show driver still assumed spoken Finnish

**Problem:** the destination card helped visually but a child/newcomer might still be unable to pronounce the Finnish sentence.

**Change:** when the browser supports Web Speech, the card offers **Read aloud in Finnish** using local browser speech synthesis. Unsupported browsers simply omit the control; no AI/API/backend is required.

### 7. Browser QA did not test the production application

**Problem:** Playwright previously ran against Vite's development server.

**Risk:** production asset paths, service-worker registration, PWA caching and deployment-like behavior were outside the browser gate.

**Change:** Playwright now builds the app and runs against Vite preview.

### 8. PWA offline behavior was weaker than the documentation implied

**Problem:** the source service worker cached the root page but did not guarantee that the first installed shell contained the hashed JavaScript/CSS required for an offline reload.

**Change:** npm run build now generates a content-versioned production service worker that precaches the complete built same-origin shell. CI verifies that every built asset is represented in the precache manifest.

The service worker intentionally does **not** cache live data.foli.fi API responses.

### 9. Offline capability was implicit

**Problem:** a user could lose connectivity without understanding which parts of the product were still trustworthy.

**Change:** an explicit offline banner explains:

- Safe Places remain local
- driver help remains available
- live departures need connectivity
- external route planning needs connectivity

External walking/transit links are withheld while the browser reports offline. The header also changes to **Offline mode**, so the global status does not visually contradict the degraded-state banner.

### 10. Realtime freshness could freeze across repeated failures

**Problem:** the UI retained same-stop data after a failed refresh, but the provider `servertime` inside that payload was also retained.

**Risk:** without advancing the reference clock, a vehicle position and monitored trip could remain labelled fresher than they really were.

**Change:** every successful Stop Monitoring response records a browser receipt timestamp. The provider clock is advanced by elapsed time since receipt, so **Due**, vehicle-position age and live-data freshness continue aging during an outage. A failed refresh also states when the last successful update was received.

The same principle is applied to the disruption feed: retained alerts remain visible, but a failed or old alert check is explicitly marked instead of silently implying the feed is current.

### 11. A dead phone had no externalized fallback

**Problem:** every digital recovery flow disappears once the device powers off.

**Risk:** no browser feature can recover from a fully dead phone, and the Battery Status API is not consistently available enough to be a safety dependency.

**Change:** Home recovery now includes **Prepare for no battery**. A caregiver can print or save a compact Home backup card containing the primary approved stop, optional approved backup stops and the Finnish driver-help sentence. It contains public stop identity, not the private home address or setup coordinates.

### 12. Offline and “live” visual language conflicted

**Problem:** the offline banner could coexist with a green-looking Föli status dot.

**Risk:** a stressed user could read the overall interface as still live.

**Change:** offline state now changes the header status to **Offline mode** with neutral warning styling. The browser connectivity signal remains advisory; API request results still decide whether realtime data is actually trustworthy.

## Intentionally unresolved limitations

These are not hidden behind optimistic wording.

### Route-level disruption completeness

Route-only alerts are matched against lines currently present in the selected stop's departure feed.

This is useful but not mathematically complete. If a route is so disrupted that it has **no visible upcoming departure**, matching only current visible lines can miss that route-level alert.

A complete solution needs coherent GTFS stop → stop_times → trips → route membership, ideally pinned to one GTFS dataset version.

### No child-optimized journey planner inside the app

Go Home delegates actual transit routing to an external Maps transit handoff.

The app therefore does not itself guarantee:

- minimum transfers
- safest walking path
- child-specific transfer penalties
- route recomputation inside the app
- wrong-bus detection

Implementing this honestly would require a routing provider such as Digitransit plus a production-safe API-key/proxy strategy and a separate itinerary UX.

### Vehicle direction is unknown

SIRI Stop Monitoring coordinates are used for straight-line vehicle-to-stop distance.

The app deliberately says **nearby**, not “approaching”, because proximity alone is not directional evidence.

A stronger directional model would need trip/shape/progress context.

### Browser connectivity is advisory

navigator.onLine is useful for UI degradation, but it does not prove that Föli or Google Maps is reachable.

Actual API request success/failure remains the authoritative signal for realtime data.

### No full localization yet

The interface is primarily English with a specific Finnish driver-help sentence.

A production public-facing version should add structured localization at least for Finnish, Swedish and English; Ukrainian would also be valuable for the newcomer use case.

### PWA icon coverage is not exhaustive

The manifest currently uses the SVG application icon. Additional raster 192×192 / 512×512 and Apple touch assets would improve platform-specific install presentation.

### No product analytics by design

There is no tracking backend or analytics SDK, which supports the privacy model.

The tradeoff is that the repository cannot claim validated adoption, retention or product-market fit from usage data.

### Repository / deployment presentation needs final cleanup

The implementation is stronger than its external metadata:

- GitHub repository description is empty
- GitHub topics are empty
- homepage still uses the legacy nuppu-assignment.vercel.app branding
- repository history is unusually large for the current source tree

These are presentation/maintenance issues rather than user-flow defects. History should not be rewritten casually.

## Release gates after this audit

A change is not considered release-ready merely because unit tests pass.

The intended gate is:

1. ESLint
2. Vitest / Testing Library
3. production Vite build
4. generated PWA precache verification
5. deterministic Playwright Chromium with service workers blocked
6. deterministic Playwright Firefox with service workers blocked
7. deterministic Playwright mobile WebKit with service workers blocked
8. real browser geolocation scenarios
9. Safe Place privacy/import scenarios
10. Get me Home recovery
11. dedicated Chromium PWA project with real service-worker offline reload
12. axe WCAG A/AA checks
13. worst-case mobile overflow
14. deterministic desktop/mobile screenshots

## Product principle

The product should optimize for **truthful useful assistance**, not maximum feature count.

When the data does not prove something, the interface should say less.

When a dependency fails, the interface should preserve the smallest useful fallback.

When a child or newcomer is stressed, the primary action should require less interpretation than the normal expert flow.
