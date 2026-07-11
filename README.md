# Chicago Restaurant Dashboard

Offline-capable prototype for scouting Chicago restaurants from public sources.

## What it does

- Ranks hot new restaurants by editorial heat, novelty, price signal, and saved user preferences.
- Organizes places by filterable cards and a tile-backed map using OpenStreetMap tiles with a local fallback.
- Makes KPI cards clickable: reset matches, sort by heat, drill into areas, and filter experience-led restaurants.
- Adds lane browsing for Hot New, Essential/Popular, Awarded, Iconic, and Personal Fit restaurants.
- Opens restaurant detail panels from cards, Details buttons, and map pins.
- Shows menu cues, source provenance, map links, and reservation/official links where available.
- Stores taste signals locally in the browser through Save, Visited, and Pass actions.
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

## Next connector layer

The seed data lives in `RESTAURANTS` and `SOURCES` inside `index.html`. A production version should replace or refresh that embedded data from:

- Editorial feeds: Eater Chicago, The Infatuation, Time Out Chicago, Chicago Magazine.
- Primary sources: restaurant official sites, booking pages, menu PDFs, Instagram announcements.
- Public civic records: Chicago business licenses and food inspections for address/status validation.
- User profile storage: localStorage now, later a small backend table keyed by user.

## Run locally

Open `index.html` directly for the static dashboard, or run:

```bash
python3 -m http.server 8000
```

Then visit <http://127.0.0.1:8000/>.

## Production Backend

The app now includes Vercel-compatible API routes for:

- Email registration and signed HttpOnly sessions: `POST /api/auth/register`
- Current user/session/profile: `GET /api/auth/me`
- Taste profile events: `POST /api/profile/event`
- Notification preferences: `GET/POST /api/subscriptions`
- Restaurant lifecycle event capture: `POST /api/restaurants/capture-event`
- Scheduled notification digest: `GET /api/notifications/digest`

Required environment variables:

- `DATABASE_URL`: Postgres connection string, for example Neon, Supabase, or Vercel Postgres.
- `APP_SECRET`: long random string for signed session cookies.
- `RESEND_API_KEY`: Resend API key for production email delivery.
- `EMAIL_FROM`: verified sender address, for example `Chicago Restaurant Dashboard <updates@yourdomain.com>`.
- `CRON_SECRET`: bearer token for protected event ingestion.

`vercel.json` includes a daily cron for `/api/notifications/digest`.

## Deployment Shape

1. Create a Postgres database and set `DATABASE_URL`.
2. Create a Resend account/domain and set `RESEND_API_KEY` plus `EMAIL_FROM`.
3. Set `APP_SECRET` and `CRON_SECRET`.
4. Deploy to Vercel. The static dashboard is served from `index.html`; API routes live under `/api`.
5. Wire future source ingestion to call `/api/restaurants/capture-event` when a restaurant is announced, awarded, or added to the dataset.
