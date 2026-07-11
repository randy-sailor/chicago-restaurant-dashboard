import { readFile } from "node:fs/promises";

const files = [
  "index.html",
  "styles.css",
  "app.js",
  "data/restaurants.js",
  "api/auth/register.js",
  "api/auth/verify.js",
  "api/auth/me.js",
  "api/profile/event.js",
  "api/subscriptions.js",
  "api/notifications/digest.js",
  "vercel.json",
  "package.json"
];

for (const file of files) {
  await readFile(file, "utf8");
}

const html = await readFile("index.html", "utf8");
const htmlMarkers = [
  "id=\"accountForm\"",
  "id=\"verifyForm\"",
  "id=\"notificationForm\"",
  "src=\"data/restaurants.js\"",
  "src=\"app.js\"",
  "href=\"styles.css\""
];
for (const marker of htmlMarkers) {
  if (!html.includes(marker)) {
    throw new Error(`Missing marker in index.html: ${marker}`);
  }
}

const app = await readFile("app.js", "utf8");
const appMarkers = [
  "/api/auth/register",
  "/api/auth/verify",
  "/api/profile/event",
  "window.DASHBOARD_DATA"
];
for (const marker of appMarkers) {
  if (!app.includes(marker)) {
    throw new Error(`Missing marker in app.js: ${marker}`);
  }
}

const data = await readFile("data/restaurants.js", "utf8");
const parsed = JSON.parse(data.slice(data.indexOf("=") + 1).replace(/;\s*$/, ""));
if (!parsed.laneDefs?.some((lane) => lane.id === "hot-new")) {
  throw new Error("Missing hot-new lane in data/restaurants.js");
}
if (!Array.isArray(parsed.restaurants) || parsed.restaurants.length === 0) {
  throw new Error("No restaurants in data/restaurants.js");
}

console.log("App structure check passed.");
