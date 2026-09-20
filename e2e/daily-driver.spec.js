import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const stopCatalog = {
  "164": { stop_name: "Kauppatori" },
  "32": { stop_name: "Puistokatu" },
};

const stopResponse = {
  status: "OK",
  stopname: "Kauppatori",
  servertime: 1900000000,
  result: [
    {
      lineref: "1",
      destinationdisplay: "Satama",
      monitored: true,
      delay: 0,
      recordedattime: 1899999990,
      expecteddeparturetime: 1900000600,
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.route("https://data.foli.fi/siri/sm", async (route) => {
    await route.fulfill({ json: stopCatalog });
  });
  await page.route(/https:\/\/data\.foli\.fi\/siri\/sm\/.+/, async (route) => {
    await route.fulfill({ json: stopResponse });
  });
  await page.route("https://data.foli.fi/alerts", async (route) => {
    await route.fulfill({ json: { messages: [], cancellations: [] } });
  });
});

test("core commute flow is usable and accessible", async ({ page }) => {
  await page.goto("/?stop=164");

  await expect(page.getByRole("heading", { name: "Kauppatori" })).toBeVisible();
  await expect(page.getByText("Satama")).toBeVisible();
  await expect(page.getByText("Live · on time")).toBeVisible();

  await page.getByRole("button", { name: "Save Kauppatori to favorites" }).click();
  await expect(page.getByRole("button", { name: "Remove Kauppatori from favorites" })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .exclude("iframe")
    .analyze();
  expect(results.violations).toEqual([]);
});

test("stop search works with keyboard on mobile-sized UI", async ({ page }) => {
  await page.goto("/?stop=164");

  const search = page.getByRole("combobox", { name: "Find your stop" });
  await search.fill("Puisto");
  await search.press("ArrowDown");
  await search.press("Enter");

  await expect(page).toHaveURL(/stop=32/);
});
