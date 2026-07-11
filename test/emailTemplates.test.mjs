import test from "node:test";
import assert from "node:assert/strict";
import { loginCodeEmail, restaurantDigestEmail, restaurantRecommendationEmail } from "../api/_lib/emailTemplates.js";
import { codesMatch, hashLoginCode } from "../api/_lib/loginCodes.js";

test("login code email contains the code in subject, text, and html", () => {
  const email = loginCodeEmail("123456");
  assert.match(email.subject, /123456/);
  assert.match(email.text, /123456/);
  assert.match(email.html, /123456/);
});

test("recommendation email escapes user-controlled content", () => {
  const email = restaurantRecommendationEmail({
    restaurant: { name: "Kasama", neighborhood: "West Town", format: "Bakery", address: "x", note: "", menu: [] },
    senderEmail: "a@example.com",
    message: "<script>alert(1)</script>",
    restaurantUrl: "https://example.com/?restaurant=kasama"
  });
  assert.ok(!email.html.includes("<script>alert(1)</script>"));
  assert.ok(email.html.includes("&lt;script&gt;"));
});

test("digest email lists each event", () => {
  const email = restaurantDigestEmail([
    { restaurant_name: "Bistro Zaza", event_type: "announced", source_title: "Eater", source_url: "https://example.com/a" },
    { restaurant_name: "Cafe Beau", event_type: "awarded", source_title: "Michelin", source_url: null }
  ]);
  assert.match(email.text, /Bistro Zaza/);
  assert.match(email.text, /Cafe Beau/);
  assert.match(email.html, /Newly announced/);
  assert.match(email.html, /Awarded/);
});

test("login codes hash deterministically and compare timing-safely", () => {
  const hash = hashLoginCode("654321");
  assert.equal(hash, hashLoginCode("654321"));
  assert.ok(codesMatch(hashLoginCode("654321"), hash));
  assert.ok(!codesMatch(hashLoginCode("000000"), hash));
});
