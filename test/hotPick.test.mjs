import test from "node:test";
import assert from "node:assert/strict";
import { dashboardUrlFor, pickHotPick, reservationFor } from "../api/_lib/hotPick.js";
import { hotPickEmail } from "../api/_lib/emailTemplates.js";
import { dashboardData } from "../api/_lib/restaurants.js";

const RESTAURANTS = [
  { id: "a", name: "A", url: "https://a.example" },
  { id: "b", name: "B", url: "https://b.example" },
  { id: "c", name: "C", url: "https://c.example" }
];

test("pickHotPick never returns an already-sent restaurant", () => {
  for (let seed = 0; seed < 20; seed += 1) {
    const pick = pickHotPick(RESTAURANTS, new Set(["a", "c"]), () => seed / 20);
    assert.equal(pick.id, "b");
  }
});

test("pickHotPick returns null once every restaurant has been sent", () => {
  assert.equal(pickHotPick(RESTAURANTS, new Set(["a", "b", "c"])), null);
});

test("simulated weekly sends cover all restaurants exactly once, then stop", () => {
  const sent = new Set();
  const picks = [];
  for (let week = 0; week < 10; week += 1) {
    const pick = pickHotPick(RESTAURANTS, sent);
    if (!pick) break;
    assert.ok(!sent.has(pick.id), "repeated a restaurant");
    sent.add(pick.id);
    picks.push(pick.id);
  }
  assert.equal(picks.length, RESTAURANTS.length);
  assert.equal(pickHotPick(RESTAURANTS, sent), null);
});

test("reservationFor prefers the stored reservation link with fallback to the restaurant url", () => {
  const links = { a: { label: "Reserve on Resy", url: "https://resy.example/a", note: "Via Resy." } };
  assert.equal(reservationFor(RESTAURANTS[0], links).url, "https://resy.example/a");
  const fallback = reservationFor(RESTAURANTS[1], links);
  assert.equal(fallback.url, "https://b.example");
  assert.match(fallback.note, /official or source page/);
});

test("every curated restaurant resolves to a usable reservation target", () => {
  const { restaurants, reservationLinks } = dashboardData();
  for (const restaurant of restaurants) {
    const reservation = reservationFor(restaurant, reservationLinks);
    assert.ok(reservation.url && reservation.url.startsWith("http"), `${restaurant.id} has no reservation target`);
    assert.ok(reservation.label);
  }
});

test("hot pick email includes details and the reservation CTA", () => {
  const email = hotPickEmail({
    restaurant: {
      id: "trino", name: "Trino", neighborhood: "West Loop", price: 4,
      format: "Latin American modern steakhouse", address: "738 W Randolph St",
      note: "Best New Restaurant signal.", menu: ["Blue shrimp", "Beef tartare"],
      url: "https://www.trinochicago.com/"
    },
    reservation: { label: "Reserve on Resy", url: "https://resy.example/trino", note: "Reservations via Resy." },
    mapsUrl: "https://maps.example/trino",
    dashboardUrl: "https://example.com/?restaurant=trino"
  });
  assert.match(email.subject, /Hot pick of the week: Trino/);
  assert.match(email.text, /Reserve on Resy: https:\/\/resy.example\/trino/);
  assert.ok(email.html.includes("https://resy.example/trino"));
  assert.ok(email.html.includes("Blue shrimp"));
  assert.ok(email.html.includes("West Loop"));
  assert.ok(email.html.includes("$$$$"));
});

test("dashboardUrlFor produces a restaurant deep link", () => {
  assert.match(dashboardUrlFor("kasama"), /\?restaurant=kasama$/);
});
