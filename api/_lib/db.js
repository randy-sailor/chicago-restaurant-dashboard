import pg from "pg";

const { Pool } = pg;

let pool;
let schemaReady;

export function getPool() {
  if (!process.env.DATABASE_URL) {
    throw Object.assign(new Error("DATABASE_URL is not configured."), { statusCode: 503 });
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: sslConfig(process.env)
    });
  }
  return pool;
}

// Verify database TLS certificates by default. Providers with a private CA
// (for example Supabase) fail default verification, so DATABASE_CA_CERT
// accepts their CA bundle (PEM, literal \n allowed) for proper pinning.
// PGSSLMODE=disable is for local Postgres without TLS;
// DATABASE_SSL_NO_VERIFY=1 is a last-resort escape hatch that keeps TLS but
// skips certificate checks.
export function sslConfig(env) {
  if (env.PGSSLMODE === "disable") return false;
  if (env.DATABASE_CA_CERT) {
    return {
      ca: env.DATABASE_CA_CERT.replace(/\\n/g, "\n"),
      rejectUnauthorized: true
    };
  }
  return { rejectUnauthorized: env.DATABASE_SSL_NO_VERIFY !== "1" };
}

export async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = getPool().query(`
      create table if not exists users (
        id uuid primary key,
        email text unique not null,
        created_at timestamptz not null default now(),
        last_seen_at timestamptz not null default now()
      );

      alter table users add column if not exists verified_at timestamptz;

      create table if not exists login_codes (
        id bigserial primary key,
        user_id uuid not null references users(id) on delete cascade,
        code_hash text not null,
        attempts integer not null default 0,
        expires_at timestamptz not null,
        consumed_at timestamptz,
        created_at timestamptz not null default now()
      );

      create table if not exists subscriptions (
        user_id uuid primary key references users(id) on delete cascade,
        hot_new boolean not null default true,
        awarded boolean not null default true,
        iconic boolean not null default false,
        essential boolean not null default false,
        frequency text not null default 'daily',
        updated_at timestamptz not null default now()
      );

      alter table subscriptions add column if not exists last_digest_at timestamptz;

      create table if not exists user_profiles (
        user_id uuid primary key references users(id) on delete cascade,
        display_name text,
        home_neighborhood text,
        favorite_cuisines text[] not null default '{}',
        dietary_preferences text[] not null default '{}',
        dining_occasions text[] not null default '{}',
        price_preference text,
        bio text,
        updated_at timestamptz not null default now()
      );

      create table if not exists taste_events (
        id bigserial primary key,
        user_id uuid not null references users(id) on delete cascade,
        restaurant_id text not null,
        action text not null check (action in ('saved', 'visited', 'passed')),
        created_at timestamptz not null default now()
      );

      create table if not exists taste_signals (
        user_id uuid not null references users(id) on delete cascade,
        restaurant_id text not null,
        action text not null check (action in ('saved', 'visited', 'passed')),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        primary key (user_id, restaurant_id, action)
      );

      create table if not exists restaurant_events (
        id bigserial primary key,
        restaurant_id text not null,
        restaurant_name text not null,
        event_type text not null check (event_type in ('announced', 'awarded', 'captured')),
        source_title text,
        source_url text,
        occurred_at timestamptz not null default now(),
        emailed_at timestamptz
      );

      create table if not exists recommendation_events (
        id bigserial primary key,
        sender_user_id uuid references users(id) on delete set null,
        sender_email text not null,
        sender_display_name text,
        recipient_email text not null,
        restaurant_id text not null,
        restaurant_name text not null,
        message text,
        created_at timestamptz not null default now()
      );

      create table if not exists source_runs (
        id bigserial primary key,
        started_at timestamptz not null default now(),
        finished_at timestamptz,
        status text not null default 'running',
        sources_checked integer not null default 0,
        items_captured integer not null default 0,
        restaurants_captured integer not null default 0,
        error text
      );

      create table if not exists source_items (
        id bigserial primary key,
        source_id text not null,
        source_title text not null,
        item_title text not null,
        item_url text not null unique,
        summary text,
        published_at timestamptz,
        captured_at timestamptz not null default now(),
        raw jsonb not null default '{}'::jsonb
      );

      create table if not exists ingested_restaurants (
        id text primary key,
        name text not null,
        source_item_url text references source_items(item_url) on delete set null,
        source_title text,
        neighborhood text,
        cuisine text[] not null default '{}',
        signals text[] not null default '{}',
        confidence numeric not null default 0,
        first_seen_at timestamptz not null default now(),
        last_seen_at timestamptz not null default now(),
        raw jsonb not null default '{}'::jsonb
      );

      create index if not exists login_codes_user_created_idx on login_codes(user_id, created_at desc);
      create index if not exists taste_events_user_created_idx on taste_events(user_id, created_at desc);
      create index if not exists restaurant_events_email_idx on restaurant_events(emailed_at, occurred_at desc);
      create index if not exists recommendation_events_sender_created_idx on recommendation_events(sender_user_id, created_at desc);
      create index if not exists source_items_captured_idx on source_items(captured_at desc);
      create index if not exists ingested_restaurants_last_seen_idx on ingested_restaurants(last_seen_at desc);
    `).catch((error) => {
      // Reset so the next request retries instead of caching the failure
      // until the serverless instance is recycled.
      schemaReady = undefined;
      throw error;
    });
  }
  return schemaReady;
}

export async function query(text, params = []) {
  await ensureSchema();
  return getPool().query(text, params);
}
