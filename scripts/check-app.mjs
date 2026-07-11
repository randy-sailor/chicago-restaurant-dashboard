import { readFile } from "node:fs/promises";

const files = [
  "index.html",
  "api/auth/register.js",
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
const requiredMarkers = [
  "id=\"accountForm\"",
  "id=\"notificationForm\"",
  "/api/auth/register",
  "/api/profile/event",
  "id: \"hot-new\""
];

for (const marker of requiredMarkers) {
  if (!html.includes(marker)) {
    throw new Error(`Missing marker in index.html: ${marker}`);
  }
}

console.log("App structure check passed.");
