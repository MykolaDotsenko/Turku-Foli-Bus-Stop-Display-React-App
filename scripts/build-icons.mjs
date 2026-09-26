// Renders the PNG app icons from public/foli-icon.svg with the Playwright
// Chromium the browser tests already use. Run it after changing the SVG:
//
//   node scripts/build-icons.mjs
//   CHROMIUM_PATH=/path/to/chrome node scripts/build-icons.mjs
//
// The SVG alone left iPhones without a home-screen icon (Safari ignores
// manifest icons and falls back to a screenshot of the page) and gave Android
// a rounded, transparent-cornered tile marked "maskable", which its own mask
// then clips a second time.
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const svg = await readFile("public/foli-icon.svg", "utf8");
const background = svg.match(/<rect[^>]*fill="([^"]+)"/)?.[1];
const glyph = svg.match(/<path[^>]*\/>/)?.[0];

if (!background || !glyph) {
  throw new Error("public/foli-icon.svg no longer has the expected tile and glyph.");
}

// A full-bleed tile for platforms that apply their own mask. The glyph is
// scaled about the centre so it stays inside the maskable safe zone, a circle
// of 40 % radius.
function fullBleed(scale) {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">',
    `<rect width="512" height="512" fill="${background}"/>`,
    `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">`,
    glyph,
    "</g></svg>",
  ].join("");
}

// The glyph alone on transparency, cropped to the bus. Android draws a
// notification's status-bar icon from the badge's alpha channel, and without
// one it shows the browser's logo instead of the app's.
function badge() {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="64 64 384 384">',
    glyph,
    "</svg>",
  ].join("");
}

const targets = [
  { file: "public/icon-192.png", size: 192, markup: svg },
  { file: "public/icon-512.png", size: 512, markup: svg },
  { file: "public/icon-maskable-512.png", size: 512, markup: fullBleed(0.78) },
  // iOS rounds the corners itself and fills transparency with black.
  { file: "public/apple-touch-icon.png", size: 180, markup: fullBleed(0.86) },
  { file: "public/notification-badge-96.png", size: 96, markup: badge() },
];

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);

try {
  for (const { file, size, markup } of targets) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    const sized = markup.replace("<svg ", `<svg width="${size}" height="${size}" `);
    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:transparent">${sized}</body></html>`
    );
    await page.screenshot({
      path: file,
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    });
    await page.close();
    console.log(`wrote ${file} (${size}×${size})`);
  }
} finally {
  await browser.close();
}
