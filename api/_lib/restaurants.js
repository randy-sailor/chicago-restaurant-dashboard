import { readFileSync } from "node:fs";

// data/restaurants.js is a browser script of the form
// `window.DASHBOARD_DATA = {...};` where the right-hand side is pure JSON,
// so the same file serves as the canonical dataset for both client and server.
const DATA_URL = new URL("../../data/restaurants.js", import.meta.url);

let cache;

export function dashboardData() {
  if (!cache) {
    const text = readFileSync(DATA_URL, "utf8");
    cache = JSON.parse(text.slice(text.indexOf("=") + 1).replace(/;\s*$/, ""));
  }
  return cache;
}

export function findRestaurant(id) {
  if (!id) return null;
  return dashboardData().restaurants.find((restaurant) => restaurant.id === id) || null;
}
