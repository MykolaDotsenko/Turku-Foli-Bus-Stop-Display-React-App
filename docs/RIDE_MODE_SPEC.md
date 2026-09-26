# Ride Mode — reliability-first product specification

## Product goal

Ride Mode exists for one job:

> Let a passenger put the phone away and still know when to get ready, when to press STOP, and when to leave the vehicle.

A missed stop is the primary failure. The design therefore optimizes for early, redundant warning while refusing to present weak evidence as certainty.

## Decision audit

| Decision | User value | Reliability | Engineering | Decision |
| --- | ---: | ---: | ---: | --- |
| Three-stage warning: SOON → NEXT → NOW | 100 | 98 | 96 | Ship |
| Missed-stop recovery | 99 | 97 | 94 | Ship |
| GTFS trip stop sequence as route plan | 98 | 96 | 98 | Ship |
| Poll target + previous stop through SIRI Stop Monitoring | 94 | 91 | 96 | Ship in client MVP |
| Match ride by dated journey → trip → vehicle → line+origin time | 97 | 96 | 97 | Ship |
| Schedule + observed delay as offline/degraded fallback | 95 | 78 | 95 | Ship, but never claim schedule-only NOW |
| GPS as local redundancy during an explicitly active ride | 93 | 86 | 89 | Ship as recommended opt-in toggle |
| Test alert before relying on Ride Mode | 100 | 98 | 95 | Ship |
| Wake Lock while Ride Mode is visible | 88 | 72 | 92 | Ship as progressive enhancement |
| System notification while the page is alive | 92 | 76 | 87 | Ship as progressive enhancement |
| Persist and restore active ride | 96 | 90 | 95 | Ship |
| Repeat NOW haptic/tone until confirmed or evidence changes | 96 | 93 | 91 | Ship |
| Media Session metadata without active media | 60 | 35 | 70 | Do not rely on it |
| Silent audio loop to keep a browser tab alive | 70 | 30 | 35 | Reject |
| Background JavaScript as a guaranteed lock-screen tracker | 100 | 20 | 25 | Reject |
| Full Föli Vehicle Monitoring feed from every phone | 90 | 85 | 45 | Reject for client; backend cache only |
| Web Push from a small ride-tracking backend | 100 | 96 | 90 | Phase 2 |
| “Any weak source says NOW → tell user to exit” | 70 | 55 | 60 | Reject |
| Wrong-bus detection from simple GPS trend only | 85 | 45 | 55 | Reject until route-shape/map-matching evidence exists |

## Why the state machine is asymmetric

Stages are monotonic:

```text
BOARDED → SOON → NEXT → NOW
                    ↘ MISSED
```

A stage never rolls backwards because GPS jitter or provider corrections should not retract a warning the passenger has already acted on.

The important distinction is **strong vs weak evidence**:

- weak evidence may move the user earlier to **SOON** or **NEXT**
- **NOW** requires stronger live/location evidence
- **MISSED** requires evidence that the target was reached/passed, not merely that its timetable time elapsed

This avoids the two worst UX failures:

1. no warning until it is too late
2. confidently telling someone to exit while the bus is still several stops away

## Evidence model

### Strong live evidence

- target row reports `vehicleatstop`
- fresh provider vehicle position is very near the target after NEXT
- local GPS is very near the target after NEXT
- target was at stop and then disappears from the target board

### Conservative early evidence

- target live ETA <= 90 seconds
- previous-stop row was observed and then disappears on consecutive successful polls while the target is still listed
- schedule fallback <= 90 seconds
- planned route has one remaining stop before target

### Degraded/offline evidence

At ride start, GTFS stop times are anchored to the selected departure's current realtime/planned departure timestamp. Relative planned offsets can therefore continue locally if requests fail.

Schedule-only evidence may emit SOON/NEXT, but it does **not** emit a definitive NOW or MISSED.

## Ride matching

A SIRI row is matched to the selected ride in this order:

1. `datedvehiclejourneyref`
2. `__tripref`
3. `vehicleref`
4. `lineref + originaimeddeparturetime`

A line number alone is never sufficient because multiple vehicles on the same line can be close together.

A matched row is live evidence only when the feed is tracking it (`monitored: true`):

- ride polling requests the realtime feed alone, never the departure board's GTFS timetable fallback, because those rows carry the same trip id
- an untracked row counts as the bus not being in the live data, and it cannot later arm the previous-stop check by dropping off the board
- an answer without realtime data (`NO_SIRI_DATA`, `PENDING`) at the target stop means the bus is not in the live data: a stop with nothing more coming can answer that way once the bus has left it, so holding the last sighting would keep the get-off alarm repeating
- the same answer at the previous stop never counts as the bus leaving it: that count raises NEXT, so it only follows answers that carry realtime data

Everything read from the target stop's row is only as current as the answer it arrived in:

- its live ETA counts down from that moment, and stops counting as live 120 s after it, when the timetable takes over
- its vehicle position ages from that moment too, so a failed poll cannot keep an old position (a loop's first pass near the stop, say) fresh enough to raise NOW
- sightings at the previous stop keep the ride's tracking badge live, but never refresh the target's estimate
- the panel says "Your bus is confirmed" only while the target (or the stop before it) answered live within the last 45 s, the same window the badge calls live, and never while the phone is offline, when the badge has already gone back to the timetable
- going by the timetable alone, the ETA reads "running late" once the target's timetable time is more than 30 s past; the timetable's own count of stops left is never used for that, because it runs on the same clock

## Client MVP data flow

```text
selected departure
      │
      ├─ GTFS stop_times/trip → ordered route plan
      │
      ├─ SIRI target stop ─────┐
      ├─ SIRI previous stop ───┼─ progress evaluator → Ride stage
      │                        │
      └─ optional device GPS ──┘
                                   │
                                   ├─ tone / vibration
                                   ├─ speech
                                   └─ system notification if available
```

Polling is intentionally limited to two stop-monitoring endpoints. This avoids downloading the large Vehicle Monitoring feed on every handset.

Föli documents the VM response as large and recommends a dedicated cache server when selected-vehicle tracking is needed. That is the Phase 2 architecture:
https://data.foli.fi/doc/siri/v0/vm-en

GTFS trip stop order comes from:
https://data.foli.fi/doc/gtfs/v0/stop_times-en

## Alert semantics

### SOON

Trigger conservatively when one of these is true:

- <= 3 planned stops remain
- live ETA <= 5 minutes
- schedule fallback ETA <= 5 minutes

Message: **Get ready — your stop is coming up.**

### NEXT

Trigger when one of these is true:

- live target ETA <= 90 seconds
- previous stop was observed, then is absent for two successful polls, while target remains listed
- <= 1 planned stop remains
- schedule fallback ETA <= 90 seconds

Message: **Next stop is yours. Press STOP now.**

### NOW

Requires stronger evidence:

- target row reports `vehicleatstop`
- fresh provider vehicle position is <= 60 m from target after NEXT
- local GPS is <= 60 m from target after NEXT

Message: **This is your stop. Exit now.**

The alert repeats every 5 s until one of these ends it:

- the passenger confirms
- two answers from the target stop after NOW began no longer list the bus; no sighting of the bus standing at the stop is needed, because a reloaded page has none and a 20 s poll can miss a short dwell
  - an untracked row for the journey still lists it: the feed has lost the bus, not seen it leave, so at NOW it neither counts nor resets the count
- three minutes have passed, which also covers a network that can report nothing at all

### MISSED

Requires post-target evidence. Before NOW has fired:

- target was previously reported at stop and is then absent
- or local GPS passes the target along the route shape
- or local GPS was near the target and then moves > 250 m away

After NOW, the bus leaving and the phone moving away is exactly what a successful exit looks like, so only GPS passing the target along the route counts, and only at riding pace: a reported speed of at least 3 m/s, or, when the phone reports no speed, within 90 s of NOW. Someone who got off and walks on down the same street is not told their stop is behind them.

Message: **It looks like your stop is behind you. Get off at the next stop.**

## Browser reliability boundary

The client MVP deliberately does **not** promise guaranteed lock-screen/background tracking.

What it does:

- requests Screen Wake Lock while the Ride Mode page is visible
- persists ride state without storing GPS coordinates
- restores and immediately re-evaluates a ride when the app reopens
- can show system notifications while JavaScript is still executing
- explicitly labels tracking health: live, delayed, or schedule fallback

What it does not do:

- silent-media hacks
- claims that iOS/Android will keep JavaScript alive after the OS suspends the page
- claims that vibration works on iOS web
- claims that a browser notification is equivalent to server Web Push

Reliable “phone locked in pocket” operation requires Phase 2: a tiny backend cache + ephemeral ride session + Web Push.

## Privacy

GPS backup is presented during Ride Mode setup as a recommended checkbox.

When enabled:

- location starts only after the user presses Start ride
- coordinates are used only in memory
- coordinates are never added to the persisted ride record
- watchPosition is stopped when Ride Mode ends
- no coordinates are sent to a backend

The persisted ride contains public transit identifiers, target stop identity, route plan, already-emitted stage and expiry.

## Expiry and cleanup

- ride sessions expire automatically after six hours
- End ride clears persisted ride state
- geolocation watch is stopped
- Wake Lock is released
- speech and repeated NOW alerts are cancelled
- notifications use one stable tag so a later alert replaces the previous ride alert

## Testing contract

### Pure unit tests

- trip matcher priority
- schedule anchoring
- stage monotonicity
- SOON/NEXT schedule fallback
- NOW strong-evidence requirement
- MISSED strong-evidence requirement, and no MISSED for someone walking on after NOW

### Hook/component tests

- persisted ride restore
- GPS cleanup
- alert transition de-duplication
- NOW repeat stops after ride completion, once the bus has gone (including after a reload at NOW), and after three minutes
- target estimates count down and target positions age while polls fail
- the tracking badge and the "confirmed" row never disagree

### E2E

- select a trip
- choose a downstream stop
- start Ride Mode
- confirm test alert UX
- feed live target ETA <= 90 s
- verify NEXT state and “Press STOP now”
- finish ride and verify Ride Mode disappears

## Phase 2

For truly reliable pocket mode:

```text
Föli VM (3–5 s shared poll)
        ↓
small cache / ride worker
        ↓
ephemeral vehicle + target session
        ↓
Web Push
        ↓
lock-screen notification / wearable
```

The backend does not need user GPS. It needs only vehicle/trip identity, target stop, push subscription and expiry.
