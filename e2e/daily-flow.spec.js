import fs from "node:fs";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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
        monitored: true,
        delay: 35,
        recordedattime: now - 20,
        expecteddeparturetime: now + 240,
        aimeddeparturetime: now + 205,
      },
      {
        lineref: isMarket ? "7" : "1",
        destinationdisplay: isMarket ? "Runosmäki" : "Satama",
        monitored: false,
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

  await page.route("https://data.foli.fi/gtfs/stops", async (route) => {
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
        messages: [
          {
            id: 21,
            isactive: true,
            priority: 10,
            affected_stops: ["164"],
            header: "Temporary stop arrangement",
            message: "Board from the signed temporary stop.",
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

  await expect(page.getByRole("heading", { name: "Kauppatori" })).toBeVisible();
  await expect(page.getByText("Temporary stop arrangement")).toBeVisible();
  await expect(page.getByText("Satama")).toBeVisible();

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

  await page.goBack();
  await expect(page).toHaveURL(/stop=164/);
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
});

test("has no serious WCAG accessibility violations", async ({ page }) => {
  await page.goto("/?stop=164");
  await expect(page.getByRole("heading", { name: "Kauppatori" })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();

  const blocking = results.violations.filter((violation) =>
    ["critical", "serious"].includes(violation.impact)
  );

  expect(blocking).toEqual([]);
});

test("mobile layout does not create horizontal page overflow", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "webkit-mobile");

  await page.goto("/?stop=164");
  await expect(page.getByRole("heading", { name: "Kauppatori" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );

  expect(overflow).toBeLessThanOrEqual(1);
});

test("captures recruiter-ready product screenshots", async ({ page }, testInfo) => {
  if (!["chromium-desktop", "webkit-mobile"].includes(testInfo.project.name)) {
    test.skip();
  }

  await page.goto("/?stop=164");
  await expect(page.getByRole("heading", { name: "Kauppatori" })).toBeVisible();

  fs.mkdirSync("artifacts/screenshots", { recursive: true });
  const fileName =
    testInfo.project.name === "webkit-mobile"
      ? "foli-mobile.png"
      : "foli-desktop.png";

  await page.screenshot({
    path: `artifacts/screenshots/${fileName}`,
    fullPage: true,
  });
});
