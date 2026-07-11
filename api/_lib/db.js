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
      ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false }
    });
  }
  return pool;
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

      create table if not exists subscriptions (
        user_id uuid primary key references users(id) on delete cascade,
        hot_new boolean not null default true,
        awarded boolean not null default true,
        iconic boolean not null default false,
        essential boolean not null default false,
        frequency text not null default 'daily',
        updated_at timestamptz not null default now()
      );

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

      create index if not exists taste_events_user_created_idx on taste_events(user_id, created_at desc);
      create index if not exists restaurant_events_email_idx on restaurant_events(emailed_at, occurred_at desc);
      create index if not exists recommendation_events_sender_created_idx on recommendation_events(sender_user_id, created_at desc);
    `);
  }
  return schemaReady;
}

export async function query(text, params = []) {
  await ensureSchema();
  return getPool().query(text, params);
}
