import fs from "node:fs";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";


function encodeSharedPlaceForTest(payload) {
  const bytes = new globalThis.TextEncoder().encode(JSON.stringify(payload));
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return globalThis
    .btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}


async function seedHome(page) {
  await page.evaluate(() => {
    localStorage.setItem(
      "foli-stop-catalog-v2",
      JSON.stringify({
        savedAt: Date.now(),
        stops: [
          {
            id: "164",
            name: "Kauppatori",
            lat: 60.4518,
            lon: 22.2666,
          },
          {
            id: "32",
            name: "Puistokatu",
            lat: 60.4488,
            lon: 22.255,
          },
          {
            id: "4",
            name: "Turun linna",
            lat: 60.4355,
            lon: 22.2345,
          },
        ],
      })
    );
    localStorage.setItem(
      "foli-my-places-v1",
      JSON.stringify([
        {
          id: "home",
          label: "Home",
          icon: "⌂",
          primaryStopId: "164",
          stops: [
            { id: "164", name: "Kauppatori" },
            { id: "32", name: "Puistokatu" },
          ],
          updatedAt: 1,
        },
      ])
    );
  });
  await page.reload();
}

function monitorPayload(stopId) {
  const now = Math.floor(Date.now() / 1000);
  const isMarket = stopId === "164";

  return {
    status: "OK",
    stopname: isMarket ? "Kauppatori" : "Turun linna",
    servertime: now,
    result: [
      {
        lineref: isMarket ? "1" : "8",
        destinationdisplay: isMarket ? "Satama" : "Kauppatori",
        destinationdisplay_en: isMarket ? "Harbour" : "Market Square",
        destinationdisplay_sv: isMarket ? "Hamnen" : "Salutorget",
        monitored: true,
        vehicleatstop: isMarket,
        __tripref: isMarket ? "trip-164-1" : "trip-4-8",
        delay: 35,
        recordedattime: now - 20,
        latitude: isMarket ? 60.4538 : 60.437,
        longitude: isMarket ? 22.2666 : 22.2345,
        expecteddeparturetime: now + 240,
        aimeddeparturetime: now + 205,
      },
      {
        lineref: isMarket ? "7" : "2",
        destinationdisplay: isMarket ? "Runosmäki" : "Satama",
        destinationdisplay_en: isMarket ? "" : "Harbour",
        destinationdisplay_sv: isMarket ? "Runosbacken" : "Hamnen",
        monitored: false,
        __tripref: isMarket ? "trip-164-7" : "trip-4-2",
        delay: null,
        aimeddeparturetime: now + 540,
      },
    ],
  };
}

async function mockFoli(page) {
  await page.route("https://data.foli.fi/siri/sm", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        "164": { stop_name: "Kauppatori" },
        "4": { stop_name: "Turun linna" },
        "32": { stop_name: "Puistokatu" },
      }),
    });
  });

  await page.route("https://data.foli.fi/gtfs/", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        host: "data.foli.fi",
        gtfspath: "/gtfs/v0",
        latest: "20260920-120000",
      }),
    });
  });

  await page.route(
    "https://data.foli.fi/gtfs/v0/20260920-120000/stops",
    async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        "164": {
          stop_name: "Kauppatori",
          stop_lat: 60.4518,
          stop_lon: 22.2666,
        },
        "4": {
          stop_name: "Turun linna",
          stop_lat: 60.4355,
          stop_lon: 22.2345,
        },
        "32": {
          stop_name: "Puistokatu",
          stop_lat: 60.4488,
          stop_lon: 22.255,
        },
      }),
    });
    }
  );

  await page.route(
    "https://data.foli.fi/gtfs/v0/20260920-120000/routes",
    async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        {
          route_id: "1",
          route_short_name: "1",
          route_long_name: "Satama-Kauppatori-Lentoasema",
          route_type: 3,
          route_color: "ffff00",
          route_text_color: "ffffff",
        },
        {
          route_id: "7",
          route_short_name: "7",
          route_long_name: "Keskusta-Runosmaki",
          route_type: 3,
          route_color: "007985",
          route_text_color: "ffffff",
        },
        {
          route_id: "8",
          route_short_name: "8",
          route_long_name: "Turun linna-Kauppatori",
          route_type: 3,
          route_color: "d20824",
          route_text_color: "ffffff",
        },
        {
          route_id: "99",
          route_short_name: "99",
          route_long_name: "Static-only test route",
          route_type: 3,
          route_color: "355c7d",
          route_text_color: "ffffff",
        },
        {
          route_id: "2",
          route_short_name: "2",
          route_long_name: "Test route",
          route_type: 3,
          route_color: "007985",
          route_text_color: "ffffff",
        },
      ]),
    });
    }
  );

  await page.route(
    "https://data.foli.fi/geojson/bounds/compact",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "MultiPolygon",
                coordinates: [
                  [
                    [
                      [21.9, 60.3],
                      [22.6, 60.3],
                      [22.6, 60.7],
                      [21.9, 60.7],
                      [21.9, 60.3],
                    ],
                  ],
                ],
              },
            },
          ],
        }),
      });
    }
  );

  await page.route(
    /https:\/\/data\.foli\.fi\/gtfs\/v0\/20260920-120000\/stop_times\/stop\/(164|4|32)/,
    async (route) => {
      const stopId = route.request().url().split("/").pop();
      const data =
        stopId === "164"
          ? [
              { trip_id: "trip-164-1", pickup_type: 0 },
              { trip_id: "trip-164-99", pickup_type: 0 },
            ]
          : stopId === "4"
            ? [{ trip_id: "trip-4-8", pickup_type: 0 }]
            : [];
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    }
  );

  await page.route(
    /https:\/\/data\.foli\.fi\/gtfs\/v0\/20260920-120000\/trips\/route\/(1|99)/,
    async (route) => {
      const routeId = route.request().url().split("/").pop();
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(
          routeId === "1"
            ? [{ trip_id: "trip-164-1" }]
            : [{ trip_id: "trip-164-99" }]
        ),
      });
    }
  );

  await page.route(
    /https:\/\/data\.foli\.fi\/gtfs\/v0\/20260920-120000\/trips\/trip\/(trip-164-1|trip-164-7|trip-4-8|trip-4-2)/,
    async (route) => {
      const tripId = route.request().url().split("/").pop();
      const wheelchair = tripId === "trip-164-7" ? 2 : 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify([
          {
            route_id: tripId.includes("-7") ? "7" : tripId.includes("-8") ? "8" : tripId.includes("-2") ? "2" : "1",
            service_id: "weekday",
            trip_headsign: tripId.includes("-7") ? "Runosmäki" : "Harbour",
            direction_id: 0,
            block_id: "block-1",
            shape_id: "shape-1",
            wheelchair_accessible: wheelchair,
            bikes_allowed: 0,
          },
        ]),
      });
    }
  );

  await page.route(
    "https://data.foli.fi/gtfs/v0/20260920-120000/stop_times/trip/trip-164-1",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify([
          {
            stop_id: "164",
            arrival_time: "17:40:00",
            departure_time: "17:41:00",
            stop_sequence: 1,
            pickup_type: 0,
            drop_off_type: 0,
            timepoint: 1,
          },
          {
            stop_id: "32",
            arrival_time: "17:46:00",
            departure_time: "17:46:00",
            stop_sequence: 2,
            pickup_type: 0,
            drop_off_type: 0,
            timepoint: 0,
          },
          {
            stop_id: "4",
            arrival_time: "17:55:00",
            departure_time: "17:55:00",
            stop_sequence: 3,
            pickup_type: 0,
            drop_off_type: 0,
            timepoint: 1,
          },
        ]),
      });
    }
  );

  await page.route("https://data.foli.fi/media/detour.png", async (route) => {
    await route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"></svg>',
    });
  });

  await page.route(/https:\/\/data\.foli\.fi\/siri\/sm\/(164|4|32)/, async (route) => {
    const stopId = route.request().url().split("/").pop();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(monitorPayload(stopId)),
    });
  });

  await page.route("https://data.foli.fi/alerts", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        servertime: Math.floor(Date.now() / 1000),
        global_message: {},
        emergency_message: {},
        messages: [
          {
            message_id: 21,
            isactive: true,
            priority: 900,
            effect: "DETOUR",
            cause: "CONSTRUCTION",
            affected_stops: [],
            affected_routes: ["1"],
            header: "Line 1 city-centre detour",
            message: "Line 1 uses a temporary route.",
            information: "Stop 14 is not in use during the works.",
            repeat: [[
              Math.floor(Date.now() / 1000) - 60,
              Math.floor(Date.now() / 1000) + 3600,
            ]],
            images: [
              {
                url: "//data.foli.fi/media/detour.png",
                title: "Temporary detour map",
                type: "image/png",
              },
            ],
          },
          {
            message_id: 22,
            isactive: true,
            priority: 950,
            effect: "NO_SERVICE",
            affected_stops: [],
            affected_routes: ["99"],
            header: "Line 99 service change",
            message: "This route has no current departure row.",
          },
        ],
        cancellations: [],
      }),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await mockFoli(page);
});

test("daily flow: search, save, navigate and restore with Back", async ({ page }) => {
  await page.goto("/?stop=164");

  await expect
    .poll(() => page.evaluate(() => globalThis.history.state?.foliStopId))
    .toBe("164");
  await expect(page.getByRole("heading", { name: "Kauppatori" })).toBeVisible();
  const detourSummary = page.getByText("Line 1 city-centre detour");
  await expect(detourSummary).toBeVisible();
  await expect(page.getByText("Detour", { exact: true })).toBeVisible();
  await expect(page.getByText("Line 99 service change")).toBeVisible();
  await expect(page.getByText("Harbour")).toBeVisible();
  await expect(page.getByText(/Bus at stop · board now/i)).toBeVisible();
  await expect(page.getByText("Wheelchair accessible").first()).toBeVisible();

  const boardPrecedesPlaceManagement = await page.evaluate(() => {
    const board = document.querySelector('[aria-labelledby="departures-title"]');
    const places = document.querySelector('[aria-labelledby="my-places-title"]');
    return Boolean(
      board &&
        places &&
        (board.compareDocumentPosition(places) &
          globalThis.Node.DOCUMENT_POSITION_FOLLOWING)
    );
  });
  expect(boardPrecedesPlaceManagement).toBe(true);

  await detourSummary.click();
  await expect(page.getByText(/Line 1 · Valid until/i)).toBeVisible();
  await expect(page.getByText("Line 1 uses a temporary route.")).toBeVisible();
  await expect(
    page.getByText("Stop 14 is not in use during the works.")
  ).toBeVisible();
  await expect(page.getByAltText("Temporary detour map")).toBeVisible();

  await page.getByRole("button", { name: "Next stops" }).first().click();
  await expect(page.getByText("Planned stop sequence")).toBeVisible();
  await expect(page.getByText("around 17:46")).toBeVisible();
  await expect(page.getByText("Puistokatu")).toBeVisible();

  const lineOneBadge = page.getByTitle("Satama-Kauppatori-Lentoasema");
  await expect(lineOneBadge).toHaveCSS("background-color", "rgb(255, 255, 0)");
  await expect(lineOneBadge).toHaveCSS("color", "rgb(0, 0, 0)");

  await page.getByRole("button", { name: "Save Kauppatori to favorites" }).click();
  await expect(
    page.getByRole("button", { name: "Remove Kauppatori from favorites" })
  ).toHaveAttribute("aria-pressed", "true");

  const search = page.getByRole("combobox", { name: "Find your stop" });
  await search.fill("Turun");
  await page.getByRole("option", { name: /Turun linna/i }).click();

  await expect(page).toHaveURL(/stop=4/);
  await expect(page.getByRole("heading", { name: "Turun linna" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Kauppatori/ })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => globalThis.history.state?.foliStopId))
    .toBe("4");

  await page.evaluate(() => globalThis.history.back());
  await expect
    .poll(() => page.evaluate(() => globalThis.location.search))
    .toBe("?stop=164");
  await expect
    .poll(() => page.evaluate(() => globalThis.history.state?.foliStopId))
    .toBe("164");
  await expect(page.getByRole("heading", { name: "Kauppatori" })).toBeVisible();
});

test("finds the nearest stop from one-time browser geolocation", async ({
  page,
  context,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");

  await context.grantPermissions(["geolocation"], {
    origin: "http://127.0.0.1:4173",
  });
  await context.setGeolocation({
    latitude: 60.45182,
    longitude: 22.26662,
  });

  await page.goto("/?stop=4");
  await expect(page.getByRole("heading", { name: "Turun linna" })).toBeVisible();

  await page.getByRole("button", { name: "Find nearest stop" }).click();

  await expect(page).toHaveURL(/stop=164/);
  await expect(page.getByRole("heading", { name: "Kauppatori" })).toBeVisible();
  await expect(page.getByText("Nearest")).toBeVisible();
  await expect(page.getByText(/Selected stop ≈/)).toBeVisible();

  const walkLink = page.getByRole("link", {
    name: "Walk to Kauppatori, stop 164, in Google Maps",
  });
  await expect(walkLink).toBeVisible();
  await expect(walkLink).toHaveAttribute("target", "_blank");

  const href = await walkLink.getAttribute("href");
  const mapsUrl = new globalThis.URL(href);
  expect(mapsUrl.searchParams.get("destination")).toBe("60.4518,22.2666");
  expect(mapsUrl.searchParams.get("travelmode")).toBe("walking");
  expect(mapsUrl.searchParams.has("origin")).toBe(false);
});


test("saves Home as a privacy-first safe arrival zone", async ({
  page,
  context,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");

  await context.grantPermissions(["geolocation"], {
    origin: "http://127.0.0.1:4173",
  });
  await context.setGeolocation({
    latitude: 60.45182,
    longitude: 22.26662,
  });

  await page.goto("/?stop=164");
  await expect(page.getByRole("heading", { name: "My Places" })).toBeVisible();

  await page.getByRole("button", { name: "Set up Home where I am now" }).click();

  await expect(
    page.getByRole("heading", { name: "Choose safe stops for Home" })
  ).toBeVisible();
  await expect(page.getByText(/Location accuracy/)).toBeVisible();

  const saveHome = page.getByRole("button", { name: "Save Home" });
  await expect(saveHome).toBeDisabled();
  await page
    .getByRole("checkbox", {
      name: /I confirm the selected stop is suitable and intended for arriving at Home/i,
    })
    .check();
  await expect(saveHome).toBeEnabled();
  await saveHome.click();

  const goHome = page.getByRole("link", {
    name: "Go Home by public transit",
  });
  await expect(goHome).toBeVisible();

  const href = await goHome.getAttribute("href");
  const transitUrl = new globalThis.URL(href);
  expect(transitUrl.searchParams.get("travelmode")).toBe("transit");
  expect(transitUrl.searchParams.get("destination")).toBe("60.4518,22.2666");
  expect(transitUrl.searchParams.has("origin")).toBe(false);

  const placeStorage = await page.evaluate(() =>
    localStorage.getItem("foli-my-places-v1")
  );
  expect(placeStorage).toContain('"id":"164"');
  expect(placeStorage).not.toContain('"id":"32"');
  expect(placeStorage).not.toContain('"id":"4"');
  expect(placeStorage).not.toContain("60.45182");
  expect(placeStorage).not.toContain("22.26662");
  expect(placeStorage).not.toContain("distanceMeters");
});


test("imports a parent-shared Safe Place only after explicit confirmation", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");

  const token = encodeSharedPlaceForTest({
    v: 1,
    p: "home",
    m: "164",
    s: [
      ["164", "Kauppatori"],
      ["32", "Puistokatu"],
    ],
  });

  await page.goto(`/?stop=164#place=${token}`);

  await expect(
    page.getByRole("heading", { name: "Add Home?" })
  ).toBeVisible();

  const beforeImport = await page.evaluate(() =>
    localStorage.getItem("foli-my-places-v1")
  );
  expect(beforeImport).toBeNull();

  await page.getByRole("button", { name: "Add Home" }).click();

  await expect(
    page.getByRole("link", { name: "Get me Home by public transit" })
  ).toBeVisible();
  await expect(page).toHaveURL(/\?stop=164$/);

  const imported = await page.evaluate(() =>
    localStorage.getItem("foli-my-places-v1")
  );
  expect(imported).toContain('"id":"164"');
  expect(imported).toContain('"id":"32"');
  expect(imported).not.toContain("lat");
  expect(imported).not.toContain("lon");
});


test("recovers to Home with one clear action and resilient fallbacks", async ({
  page,
}) => {
  await page.goto("/?stop=164");
  await seedHome(page);

  const recovery = page.locator(
    'section[aria-labelledby="home-recovery-title"]'
  );
  await expect(
    recovery.getByRole("heading", {
      name: "Need help getting home?",
    })
  ).toBeVisible();
  await expect(
    recovery.getByText(/travel help, not an emergency service/i)
  ).toBeVisible();

  const getHome = recovery.getByRole("link", {
    name: "Get me Home by public transit",
  });
  const href = await getHome.getAttribute("href");
  const homeUrl = new globalThis.URL(href);

  expect(homeUrl.searchParams.get("travelmode")).toBe("transit");
  expect(homeUrl.searchParams.get("destination")).toBe("60.4518,22.2666");
  expect(homeUrl.searchParams.has("origin")).toBe(false);

  const moreHomeOptions = recovery.getByRole("button", { name: "More" });
  if (await moreHomeOptions.isVisible()) {
    await moreHomeOptions.click();
  }
  await recovery.getByRole("button", { name: "Show driver" }).click();
  const driver = recovery.getByRole("dialog");
  await expect(
    driver.getByRole("heading", { name: "I need to get to Home" })
  ).toBeVisible();
  await expect(driver.getByText("Kauppatori")).toBeVisible();

  await driver.getByRole("button", { name: "Close" }).click();
  await recovery.getByText("Other saved Home stop").click();

  const backupRoute = recovery.getByRole("link", {
    name: "Get to backup Home stop Puistokatu, stop 32, by public transit",
  });
  const backupHref = await backupRoute.getAttribute("href");
  const backupUrl = new globalThis.URL(backupHref);

  expect(backupUrl.searchParams.get("destination")).toBe("60.4488,22.255");
  expect(backupUrl.searchParams.has("origin")).toBe(false);
});



test("keeps the live departure board above place management in the normal flow", async ({
  page,
}) => {
  await page.goto("/?stop=164");
  await seedHome(page);

  const board = page.locator('section[aria-labelledby="departures-title"]');
  const places = page.locator('section[aria-labelledby="my-places-title"]');

  const boardBox = await board.boundingBox();
  const placesBox = await places.boundingBox();

  expect(boardBox).not.toBeNull();
  expect(placesBox).not.toBeNull();
  expect(boardBox.y).toBeLessThan(placesBox.y);
});

test("renders a public-stop-only Home backup card in print mode", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");

  await page.goto("/?stop=164");
  await seedHome(page);
  await page.emulateMedia({ media: "print" });

  const printCard = page.getByText("Föli Home backup card");
  await expect(printCard).toBeVisible();
  await expect(page.getByText("Stop 164 · primary")).toBeVisible();
  await expect(page.getByText("Puistokatu · Stop 32")).toBeVisible();

  const headerVisibility = await page
    .locator(".topbar")
    .evaluate(
      (element) => globalThis.getComputedStyle(element).visibility
    );
  expect(headerVisibility).toBe("hidden");
});

test("production PWA reopens offline with Safe Places and driver help", async ({
  page,
  context,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-pwa");

  await page.goto("/?stop=164");
  await seedHome(page);
  await expect(page.getByRole("heading", { name: "Kauppatori" })).toBeVisible();

  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);

  await page.unrouteAll({ behavior: "wait" });
  await context.setOffline(true);
  await expect
    .poll(() => page.evaluate(() => navigator.onLine))
    .toBe(false);

  // Playwright's Chromium offline emulation does not consistently dispatch
  // the browser's offline event to a service-worker-controlled page. Deliver
  // that standard event explicitly, then verify both the live degraded UI and
  // the persisted reload hint before testing the cached PWA reload itself.
  await page.evaluate(() => {
    window.dispatchEvent(new globalThis.Event("offline"));
  });
  await expect(page.getByText("Offline", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        globalThis.localStorage.getItem("foli-offline-hint")
      )
    )
    .toBe("1");

  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(page.getByText("Offline", { exact: true })).toBeVisible();
  await expect(page.getByText("Offline mode", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Saved Safe Places and driver help still work/i)
  ).toBeVisible();

  const recovery = page.locator(
    'section[aria-labelledby="home-recovery-title"]'
  );
  await expect(
    recovery.getByRole("heading", {
      name: "Need help getting home?",
    })
  ).toBeVisible();
  await expect(
    recovery.getByRole("button", { name: "Get me Home" })
  ).toBeDisabled();

  await recovery.getByRole("button", { name: "Show driver" }).click();
  const driver = recovery.getByRole("dialog");
  await expect(
    driver.getByRole("heading", { name: "I need to get to Home" })
  ).toBeVisible();
  await expect(driver.getByText("Kauppatori")).toBeVisible();

  await driver.getByRole("button", { name: "Close" }).click();
  await mockFoli(page);
  await context.setOffline(false);
  await page.evaluate(() => {
    window.dispatchEvent(new globalThis.Event("online"));
  });

  await expect(page.getByText("Offline", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Offline mode", { exact: true })).toHaveCount(0);
  await expect(
    recovery.getByRole("link", { name: "Get me Home by public transit" })
  ).toBeVisible();
});

test("has no serious WCAG accessibility violations", async ({ page }) => {
  await page.goto("/?stop=164");
  await seedHome(page);
  await expect(page.getByRole("heading", { name: "Kauppatori" })).toBeVisible();

  const alertDetails = page.getByText("Line 1 city-centre detour").first();
  if (await alertDetails.isVisible()) {
    await alertDetails.click();
    await expect(page.getByAltText("Temporary detour map")).toBeVisible();
  }

  const nextStops = page.getByRole("button", { name: "Next stops" }).first();
  if (await nextStops.isVisible()) {
    await nextStops.click();
    await expect(page.getByText("Planned stop sequence")).toBeVisible();
  }

  const recovery = page.locator(
    'section[aria-labelledby="home-recovery-title"]'
  );
  const recoveryMore = recovery.getByRole("button", { name: "More" });
  if (await recoveryMore.isVisible()) {
    await recoveryMore.click();
  }
  await recovery.getByRole("button", { name: "Show driver" }).click();
  await expect(recovery.getByRole("dialog")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});

test("mobile layout does not create horizontal page overflow", async ({
  page,
}, testInfo) => {
  test.skip(
    !["webkit-mobile", "chromium-mobile"].includes(testInfo.project.name)
  );

  await page.goto("/?stop=164");
  await seedHome(page);
  await expect(page.getByRole("heading", { name: "Kauppatori" })).toBeVisible();

  const recovery = page.locator(
    'section[aria-labelledby="home-recovery-title"]'
  );
  const moreHomeOptions = recovery.getByRole("button", { name: "More" });
  if (await moreHomeOptions.isVisible()) {
    await moreHomeOptions.click();
  }
  await recovery.getByText("Other saved Home stop").click();
  await expect(
    recovery.getByRole("link", {
      name: "Get to backup Home stop Puistokatu, stop 32, by public transit",
    })
  ).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );

  expect(overflow).toBeLessThanOrEqual(1);
});

test("mobile first screen shows a real departure without scrolling", async ({
  page,
}, testInfo) => {
  test.skip(
    !["webkit-mobile", "chromium-mobile"].includes(testInfo.project.name)
  );

  await page.goto("/?stop=164");
  await seedHome(page);
  await expect(page.getByRole("heading", { name: "Kauppatori" })).toBeVisible();

  const firstDeparture = page.locator("tbody tr").first();
  await expect(firstDeparture).toBeVisible();

  const metrics = await firstDeparture.evaluate((row) => {
    const rect = row.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom,
      viewportHeight: window.innerHeight,
      scrollY: window.scrollY,
    };
  });

  expect(metrics.scrollY).toBe(0);
  expect(metrics.top).toBeGreaterThanOrEqual(0);
  expect(metrics.top).toBeLessThan(metrics.viewportHeight);
});

test("narrow 320 and 360px layouts keep core controls on-screen", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 360, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/?stop=164");
    await seedHome(page);
    await expect(page.getByRole("heading", { name: "Kauppatori" })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await expect(
      page.getByRole("combobox", { name: "Find your stop" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Show departures" })
    ).toBeVisible();
  }
});

test("deep links survive reload and invalid stop links recover canonically", async ({ page }) => {
  await page.goto("/?stop=4");
  await expect(page.getByRole("heading", { name: "Turun linna" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => globalThis.history.state?.foliStopId))
    .toBe("4");

  await page.reload();
  await expect(page).toHaveURL(/stop=4/);
  await expect(page.getByRole("heading", { name: "Turun linna" })).toBeVisible();

  await page.goto("/?stop=not-a-stop");
  await expect(page).toHaveURL(/stop=164/);
  await expect(page.getByRole("heading", { name: "Kauppatori" })).toBeVisible();
});

test("ten departures remain scan-friendly without horizontal table scrolling", async ({
  page,
}, testInfo) => {
  test.skip(
    !["webkit-mobile", "chromium-mobile"].includes(testInfo.project.name)
  );

  await page.route("https://data.foli.fi/siri/sm/164", async (route) => {
    const now = Math.floor(Date.now() / 1000);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        status: "OK",
        stopname: "Kauppatori",
        servertime: now,
        result: Array.from({ length: 10 }, (_, index) => ({
          lineref: String(index + 1),
          destinationdisplay:
            index === 0
              ? "Very long destination name through the city centre"
              : `Destination ${index + 1}`,
          monitored: index % 2 === 0,
          delay: index % 2 === 0 ? index * 10 : null,
          recordedattime: now - 15,
          expecteddeparturetime: index % 2 === 0 ? now + 180 + index * 120 : null,
          aimeddeparturetime: now + 180 + index * 120,
        })),
      }),
    });
  });

  await page.goto("/?stop=164");
  await expect(page.getByRole("heading", { name: "Kauppatori" })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(10);

  const tableMetrics = await page.locator("table").evaluate((table) => ({
    scrollWidth: table.scrollWidth,
    clientWidth: table.parentElement.clientWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(tableMetrics.scrollWidth - tableMetrics.clientWidth).toBeLessThanOrEqual(1);

  const pageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(pageOverflow).toBeLessThanOrEqual(1);

  fs.mkdirSync("artifacts/screenshots", { recursive: true });
  await page.screenshot({
    path: `artifacts/screenshots/foli-${testInfo.project.name}-ten-departures.png`,
    fullPage: true,
  });
});

test("six simultaneous alerts stay compact and keep departures reachable", async ({
  page,
}, testInfo) => {
  test.skip(
    !["webkit-mobile", "chromium-mobile"].includes(testInfo.project.name)
  );

  await page.route("https://data.foli.fi/alerts", async (route) => {
    const now = Math.floor(Date.now() / 1000);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        servertime: now,
        global_message: {},
        emergency_message: {},
        messages: Array.from({ length: 6 }, (_, index) => ({
          message_id: 100 + index,
          isactive: true,
          priority: 1000 - index,
          effect: index === 0 ? "NO_SERVICE" : "DETOUR",
          cause: "CONSTRUCTION",
          affected_stops: ["164"],
          affected_routes: [],
          header: `Service update ${index + 1}`,
          message: `Important passenger information ${index + 1}.`,
          repeat: [[now - 60, now + 3600]],
          images: [],
        })),
        cancellations: [],
      }),
    });
  });

  await page.goto("/?stop=164");
  await expect(page.getByLabel("6 service updates")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Show 2 more updates" })
  ).toBeVisible();

  const firstDeparture = page.locator("tbody tr").first();
  await expect(firstDeparture).toBeVisible();
  const position = await firstDeparture.evaluate((row) => {
    const rect = row.getBoundingClientRect();
    return { top: rect.top, viewportHeight: window.innerHeight };
  });
  expect(position.top).toBeLessThan(position.viewportHeight);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("200 percent text scaling keeps core mobile controls usable", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/?stop=164");
  await page.addStyleTag({ content: ":root { font-size: 200% !important; }" });

  await expect(page.getByRole("heading", { name: "Kauppatori" })).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Find your stop" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Show departures" })
  ).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);

  for (const locator of [
    page.getByRole("combobox", { name: "Find your stop" }),
    page.getByRole("button", { name: "Show departures" }),
    page.getByRole("button", { name: "Refresh" }),
  ]) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(360);
  }
});

test("captures recruiter-ready product screenshots", async ({ page }, testInfo) => {
  if (
    !["chromium-desktop", "webkit-mobile", "chromium-mobile"].includes(
      testInfo.project.name
    )
  ) {
    test.skip();
  }

  await page.goto("/?stop=164");
  await seedHome(page);
  await expect(page.getByRole("heading", { name: "Kauppatori" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Get me Home by public transit" })
  ).toBeVisible();

  fs.mkdirSync("artifacts/screenshots", { recursive: true });
  const fileName =
    testInfo.project.name === "webkit-mobile"
      ? "foli-mobile-ios.png"
      : testInfo.project.name === "chromium-mobile"
        ? "foli-mobile-android.png"
        : "foli-desktop.png";

  await page.screenshot({
    path: `artifacts/screenshots/${fileName}`,
    fullPage: true,
  });
});
