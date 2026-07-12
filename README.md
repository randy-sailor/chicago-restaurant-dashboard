# Chicago Restaurant Dashboard

Offline-capable prototype for scouting Chicago restaurants from public sources.

## What it does

- Ranks hot new restaurants by editorial heat, novelty, price signal, and saved user preferences.
- Organizes places by filterable cards and a tile-backed map using OpenStreetMap tiles with a local fallback.
- Makes KPI cards clickable: reset matches, sort by heat, drill into areas, and filter experience-led restaurants.
- Adds lane browsing for Hot New, Essential/Popular, Awarded, Iconic, and Personal Fit restaurants.
- Opens restaurant detail panels from cards, Details buttons, and map pins.
- Shows menu cues, source provenance, map links, and reservation/official links where available.
- Stores taste signals locally and syncs them to Supabase for signed-in users.
- Supports account profiles with display name, neighborhood, cuisines, dietary preferences, dining occasions, price comfort, and a profile note.
- Sends branded profile, digest, and restaurant recommendation emails through Resend.
- Captures scheduled public-source ingestion runs into Supabase for source auditing and future dataset review.
- Tracks public-source provenance for each restaurant card.

## Current seed sources

- Eater Chicago Heatmap, updated May 14, 2026: <https://chicago.eater.com/maps/new-best-restaurants-in-chicago-heatmap>
- Eater Chicago 38, Spring 2026 edition: <https://chicago.eater.com/maps/38-best-restaurants-in-chicago>
- Eater Chicago Awards, published Dec. 3, 2025: <https://chicago.eater.com/restaurant-news/165878/eater-awards-winners-chicago-2025>
- Michelin Guide Chicago restaurants: <https://guide.michelin.com/us/en/illinois/chicago/restaurants>
- Eater Chicago iconic dish crawl, published June 2026: <https://chicago.eater.com/dining-out/168355/chicago-iconic-dish-food-crawl>
- Eater Chicago Han Cha/Yunomi story, published July 8, 2026: <https://chicago.eater.com/restaurant-news/168532/yunomi-cocktail-bar-han-cha-tea-room-open-stony-island-arts-bank-theaster-gates>
- Eater Chicago Muhajir/Bobo story, published June 30, 2026: <https://chicago.eater.com/restaurant-news/168434/muhajir-restaurant-bobo-filipino-bar-new-opening-july-2026>
- Eater Chicago June openings, published June 9, 2026: <https://chicago.eater.com/restaurant-news/168102/11-chicago-restaurant-bar-openings-june-2026>
- Eater Chicago Naia opening, published May 28, 2026: <https://chicago.eater.com/restaurant-news/167998/naia-restaurant-opening-riverwalk-chicago-prime-provisions>
- Eater Chicago Guillotine Bakery opening, published June 3, 2026: <https://chicago.eater.com/restaurant-news/168047/guillotine-bakery-opening-west-town-french-pastry>
- Axios Chicago Fulton Market openings, published April 14, 2026: <https://www.axios.com/local/chicago/2026/04/14/fulton-market-mendocino-prasino-do-rite-pizza-lobo-labriola>
- OpenStreetMap raster tiles for the map viewport: <https://tile.openstreetmap.org/>

## Source ingestion layer

The curated seed data lives in `data/restaurants.js` (shared by the frontend and the API), and production also has a scheduled ingestion layer:

- `GET/POST /api/ingestion/run`: protected by Vercel Cron or `Authorization: Bearer $CRON_SECRET`.
- `GET /api/ingestion/status`: latest ingestion runs, captured source items, and restaurant candidates.
- Tables: `source_runs`, `source_items`, `ingested_restaurants`, and `restaurant_events`.
- Current source refresh targets: Eater Chicago RSS, Time Out Chicago restaurants, Chicago Reader Food & Drink, and MICHELIN Guide Chicago.

The next editorial workflow is to review `ingested_restaurants` and promote confirmed entries into the curated dashboard dataset.

## Project structure

- `index.html`: page markup only.
- `styles.css`: all styling.
- `app.js`: dashboard behavior.
- `data/restaurants.js`: the canonical curated dataset (`window.DASHBOARD_DATA = <json>;`). The browser loads it as a script; the API reads and parses the same file via `api/_lib/restaurants.js`, so recommendations are validated against the same data the UI shows.
- `api/`: Vercel serverless routes with shared helpers in `api/_lib/`.
- `test/`: `node:test` unit tests for sessions, digest logic, ingestion parsing, templates, and the dataset.

## Run locally

Open `index.html` directly for the static dashboard, or run:

```bash
python3 -m http.server 8000
```

Then visit <http://127.0.0.1:8000/>.

Run checks and tests:

```bash
npm install
npm test
```

## Production Backend

The app includes Vercel-compatible API routes for:

- Request an email sign-in code: `POST /api/auth/register`
- Verify the code and receive a signed HttpOnly session: `POST /api/auth/verify`
- Current user/session/profile: `GET /api/auth/me`
- Sign out: `POST /api/auth/logout`
- Taste signals (save/visit/pass, with toggle-off): `POST /api/profile/event`
- Notification preferences: `GET/POST /api/subscriptions`
- Restaurant lifecycle event capture: `POST /api/restaurants/capture-event`
- Scheduled notification digest: `GET /api/notifications/digest`
- Account profile save/load: `GET/POST /api/profile`
- Restaurant recommendation emails: `POST /api/recommendations/send`
- Scheduled source ingestion: `GET/POST /api/ingestion/run`
- Source ingestion status: `GET /api/ingestion/status`

Accounts are verified by a 6-digit emailed code (15-minute expiry, single use, rate limited) before any session cookie is issued. Recommendation emails are rate limited per sender and built entirely from the server-side dataset, so only curated restaurants can be shared. The digest honors each user's daily/weekly frequency via per-user delivery tracking (`subscriptions.last_digest_at`) and only emails verified users.

Required environment variables:

- `DATABASE_URL`: Postgres connection string, for example Neon, Supabase, or Vercel Postgres. TLS certificates are verified by default. Providers with a private CA (Supabase) need `DATABASE_CA_CERT` set to their downloadable CA certificate; see `.env.example` for details and local overrides.
- `APP_SECRET`: long random string for signed session cookies. The API refuses to start sessions without it in production.
- `RESEND_API_KEY`: Resend API key for production email delivery.
- `EMAIL_FROM`: verified sender address, for example `Chicago Restaurant Dashboard <updates@chicagorestaurantdashboard.com>`.
- `CRON_SECRET`: bearer token required by the cron/event routes (`/api/ingestion/run`, `/api/notifications/digest`, `/api/restaurants/capture-event`). These routes fail closed if it is unset. Vercel sends it automatically on scheduled invocations.

`vercel.json` includes daily crons for `/api/ingestion/run` and `/api/notifications/digest`, plus security headers (CSP, frame-ancestors, nosniff).

Resend note: while Resend is in testing mode, it only sends to the account owner's email. To send restaurant recommendations to arbitrary recipients, verify a sending domain in Resend and set `EMAIL_FROM` to an address on that domain.

## Deployment Shape

1. Create a Postgres database and set `DATABASE_URL`.
2. Create a Resend account/domain and set `RESEND_API_KEY` plus `EMAIL_FROM`.
3. Set `APP_SECRET` and `CRON_SECRET`.
4. Deploy to Vercel. The static dashboard is served from `index.html`; API routes live under `/api`.
5. Verify the sending domain in Resend before public recommendation sharing.
