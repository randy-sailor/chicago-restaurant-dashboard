import { query } from "./db.js";

const DEFAULT_SOURCES = [
  {
    id: "eater-chicago",
    title: "Eater Chicago",
    url: "https://chicago.eater.com/rss/index.xml",
    kind: "rss"
  },
  {
    id: "timeout-chicago-restaurants",
    title: "Time Out Chicago Restaurants",
    url: "https://www.timeout.com/chicago/restaurants",
    kind: "html"
  },
  {
    id: "chicago-reader-food",
    title: "Chicago Reader Food & Drink",
    url: "https://chicagoreader.com/food-drink/",
    kind: "html"
  },
  {
    id: "michelin-chicago",
    title: "MICHELIN Guide Chicago",
    url: "https://guide.michelin.com/us/en/illinois/chicago/restaurants",
    kind: "html"
  }
];

const RESTAURANT_HINTS = [
  "restaurant", "restaurants", "chef", "menu", "opening", "opens", "opened",
  "dining", "bar", "tavern", "bakery", "cafe", "café", "omakase", "pizza",
  "sandwich", "michelin", "james beard", "brunch", "cocktail"
];

const GENERIC_LIST_PATTERNS = [
  /^\d+\s+/i,
  /^the\s+best\s+/i,
  /^best\s+/i,
  /^every\s+/i,
  /^all-time\s+/i,
  /^where\s+to\s+/i,
  /^guide\s+to\s+/i,
  /restaurant openings/i,
  /anticipated restaurant openings/i,
  /michelin-starred restaurants/i,
  /restaurants in chicago/i,
  /delivery and takeout/i,
  /coffee shops/i
];

function cleanText(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(value) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function decodeXml(value = "") {
  return cleanText(value)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'");
}

function tagValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function linkValue(xml) {
  const direct = tagValue(xml, "link");
  if (direct) return direct;
  const atom = xml.match(/<link[^>]+href=["']([^"']+)["']/i);
  return atom ? atom[1] : "";
}

function parseRssItems(xml, source) {
  const itemMatches = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)];
  const entryMatches = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)];
  return [...itemMatches, ...entryMatches].slice(0, 30).map(([item]) => ({
    sourceId: source.id,
    sourceTitle: source.title,
    title: tagValue(item, "title"),
    url: linkValue(item),
    summary: tagValue(item, "description") || tagValue(item, "summary") || tagValue(item, "content:encoded"),
    publishedAt: tagValue(item, "pubDate") || tagValue(item, "published") || tagValue(item, "updated")
  })).filter((item) => item.title && item.url);
}

function parseHtmlItems(html, source) {
  const anchors = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const seen = new Set();
  return anchors.map(([, href, label]) => {
    const title = cleanText(label);
    if (!title || title.length < 8 || title.length > 140) return null;
    let url;
    try {
      url = new URL(href, source.url).toString();
    } catch {
      return null;
    }
    const key = `${title}|${url}`;
    if (seen.has(key)) return null;
    seen.add(key);
    return {
      sourceId: source.id,
      sourceTitle: source.title,
      title,
      url,
      summary: "",
      publishedAt: null
    };
  }).filter(Boolean).slice(0, 35);
}

function isRestaurantItem(item) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  return RESTAURANT_HINTS.some((hint) => text.includes(hint));
}

function extractCandidateName(item) {
  const title = cleanText(item.title)
    .replace(/^review:\s*/i, "")
    .replace(/\s+-\s+.*$/, "")
    .replace(/\s+\|\s+.*$/, "");
  if (GENERIC_LIST_PATTERNS.some((pattern) => pattern.test(title))) return "";
  const quoted = title.match(/[“"']([^“"']{3,70})[”"']/);
  if (quoted) return quoted[1];
  const beforeVerb = title.match(/^(.{3,70}?)\s+(opens|opened|is opening|debuts|lands|adds|brings|wins|earns)\b/i);
  if (beforeVerb) return beforeVerb[1];
  const afterOf = title.match(/\bof\s+([A-Z][A-Za-z0-9&'’.\-\s]{2,70})$/);
  if (afterOf) return afterOf[1];
  const afterAt = title.match(/\bat\s+(.{3,70})$/i);
  if (afterAt) return afterAt[1];
  return title.split(/[:,]/)[0].trim().slice(0, 70);
}

function normalizedDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function fetchSource(source) {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": "ChicagoRestaurantDashboard/1.0 (+https://chicagorestaurantdashboard.com)"
    }
  });
  if (!response.ok) {
    throw new Error(`${source.title} failed with ${response.status}`);
  }
  const body = await response.text();
  return source.kind === "rss" || /<rss|<feed/i.test(body) ? parseRssItems(body, source) : parseHtmlItems(body, source);
}

async function upsertSourceItem(item) {
  const result = await query(
    `insert into source_items (source_id, source_title, item_title, item_url, summary, published_at, raw)
     values ($1, $2, $3, $4, $5, nullif($6, '')::timestamptz, $7::jsonb)
     on conflict (item_url)
     do update set
       item_title = excluded.item_title,
       summary = excluded.summary,
       captured_at = now(),
       raw = excluded.raw
     returning (xmax = 0) as inserted`,
    [
      item.sourceId,
      item.sourceTitle,
      item.title,
      item.url,
      cleanText(item.summary).slice(0, 1000),
      normalizedDate(item.publishedAt),
      JSON.stringify(item)
    ]
  );
  return Boolean(result.rows[0]?.inserted);
}

async function upsertRestaurantCandidate(item) {
  const name = extractCandidateName(item);
  if (!name || name.length < 3 || GENERIC_LIST_PATTERNS.some((pattern) => pattern.test(name))) return false;
  const id = slug(name);
  const result = await query(
    `insert into ingested_restaurants (id, name, source_item_url, source_title, signals, confidence, raw)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb)
     on conflict (id)
     do update set
       source_item_url = excluded.source_item_url,
       source_title = excluded.source_title,
       signals = array(select distinct unnest(ingested_restaurants.signals || excluded.signals)),
       confidence = greatest(ingested_restaurants.confidence, excluded.confidence),
       last_seen_at = now(),
       raw = excluded.raw
     returning (xmax = 0) as inserted`,
    [
      id,
      name,
      item.url,
      item.sourceTitle,
      ["captured"],
      0.62,
      JSON.stringify(item)
    ]
  );
  const inserted = Boolean(result.rows[0]?.inserted);
  if (inserted) {
    await query(
      `insert into restaurant_events (restaurant_id, restaurant_name, event_type, source_title, source_url)
       values ($1, $2, 'captured', $3, $4)`,
      [id, name, item.title, item.url]
    );
  }
  return inserted;
}

async function cleanupLowQualityCandidates() {
  await query(
    `delete from ingested_restaurants
     where confidence <= 0.62
       and (
         name ~* '^\\d+\\s+'
         or name ~* '^(the best|best|every|all-time|where to|guide to)\\s+'
         or name ~* 'restaurant openings'
         or name ~* 'restaurants in chicago'
         or name ~* 'michelin-starred restaurants'
         or name ~* 'delivery and takeout'
         or name ~* 'coffee shops'
         or name in ('Chicago', 'Barcelona')
       )`
  );
}

export async function runSourceIngestion({ sources = DEFAULT_SOURCES } = {}) {
  const run = await query(`insert into source_runs default values returning id`);
  const runId = run.rows[0].id;
  let itemsCaptured = 0;
  let restaurantsCaptured = 0;
  const errors = [];

  for (const source of sources) {
    try {
      const items = (await fetchSource(source)).filter(isRestaurantItem);
      for (const item of items) {
        const inserted = await upsertSourceItem(item);
        if (inserted) itemsCaptured += 1;
        const restaurantInserted = await upsertRestaurantCandidate(item);
        if (restaurantInserted) restaurantsCaptured += 1;
      }
    } catch (error) {
      errors.push(`${source.id}: ${error.message}`);
    }
  }

  await cleanupLowQualityCandidates();

  const status = errors.length === sources.length ? "failed" : errors.length ? "partial" : "complete";
  await query(
    `update source_runs
     set finished_at = now(),
         status = $2,
         sources_checked = $3,
         items_captured = $4,
         restaurants_captured = $5,
         error = $6
     where id = $1`,
    [runId, status, sources.length, itemsCaptured, restaurantsCaptured, errors.join("; ") || null]
  );

  return { runId, status, sourcesChecked: sources.length, itemsCaptured, restaurantsCaptured, errors };
}

export async function latestIngestionStatus() {
  const [runs, items, restaurants] = await Promise.all([
    query(`select * from source_runs order by started_at desc limit 5`),
    query(`select source_title, item_title, item_url, captured_at from source_items order by captured_at desc limit 10`),
    query(`select name, source_title, source_item_url, last_seen_at from ingested_restaurants order by last_seen_at desc limit 10`)
  ]);
  return { runs: runs.rows, items: items.rows, restaurants: restaurants.rows };
}
