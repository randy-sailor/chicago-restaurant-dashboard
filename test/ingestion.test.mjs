import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanText,
  extractCandidateName,
  isRestaurantItem,
  parseHtmlItems,
  parseRssItems,
  slug
} from "../api/_lib/ingestion.js";

test("cleanText strips markup and entities", () => {
  assert.equal(cleanText("<![CDATA[Hello <b>world</b> &amp; more]]>"), "Hello world & more");
  assert.equal(cleanText("  spaced   out  "), "spaced out");
});

test("slug is url-safe and bounded", () => {
  assert.equal(slug("Milly's Pizza in the Pan!"), "milly-s-pizza-in-the-pan");
  assert.ok(slug("x".repeat(200)).length <= 80);
});

test("parseRssItems reads rss and atom entries", () => {
  const xml = `
    <rss><channel>
      <item><title>Chef Opens Bistro</title><link>https://example.com/a</link><description>A restaurant opening</description><pubDate>Wed, 08 Jul 2026 12:00:00 GMT</pubDate></item>
    </channel></rss>`;
  const items = parseRssItems(xml, { id: "s", title: "Source" });
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Chef Opens Bistro");
  assert.equal(items[0].url, "https://example.com/a");
});

test("parseHtmlItems resolves relative links and dedupes", () => {
  const html = `
    <a href="/story-one">A New Restaurant Opens In Town</a>
    <a href="/story-one">A New Restaurant Opens In Town</a>
    <a href="https://other.example/story">Another Dining Room Story Here</a>
    <a href="/short">tiny</a>`;
  const items = parseHtmlItems(html, { id: "s", title: "Source", url: "https://example.com/base" });
  assert.equal(items.length, 2);
  assert.equal(items[0].url, "https://example.com/story-one");
});

test("isRestaurantItem keys off dining vocabulary", () => {
  assert.equal(isRestaurantItem({ title: "New omakase counter debuts", summary: "" }), true);
  assert.equal(isRestaurantItem({ title: "City council votes on zoning", summary: "" }), false);
});

test("extractCandidateName finds names and rejects listicles", () => {
  assert.equal(extractCandidateName({ title: "Bistro Zaza Opens in Logan Square" }), "Bistro Zaza");
  assert.equal(extractCandidateName({ title: "The Best Tacos in Chicago" }), "");
  assert.equal(extractCandidateName({ title: "Where to Eat Right Now" }), "");
});
