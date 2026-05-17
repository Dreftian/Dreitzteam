-- Schema InsForge para el catálogo compartido Dreitz/Keys.
-- Keys (admin) escribe. Dreitz (cliente) lee. Las tablas locales en SQLite
-- mantienen la misma forma para que el adapter pueda hacer upserts directos.

create table if not exists games (
  id                       bigint primary key,
  steam_app_id             bigint,
  title                    text not null,
  short_description        text,
  detailed_description     text,
  developer                text,
  publisher                text,
  release_date             text,
  release_at               timestamptz,
  header_image             text,
  capsule_image            text,
  background_image         text,
  screenshots              jsonb,
  trailer_url              text,
  genres                   jsonb,
  categories               jsonb,
  languages                text,
  pc_requirements_min      text,
  pc_requirements_rec      text,
  price_initial            numeric,
  price_final              numeric,
  discount_percent         integer default 0,
  discount_ends_at         timestamptz,
  currency                 text default 'PEN',
  stock                    integer default 0,
  is_featured              boolean default false,
  is_active                boolean default true,
  is_dlc                   boolean default false,
  is_demo                  boolean default false,
  is_preorder              boolean default false,
  parent_game_id           bigint,
  drm_platform             text default 'dreitz',
  steam_review_score       integer,
  steam_review_count       integer,
  steam_recent_score       integer,
  metacritic_score         integer,
  updated_at               timestamptz default now()
);

create index if not exists games_active_idx on games(is_active, is_featured);
create index if not exists games_drm_idx on games(drm_platform);

create table if not exists licenses (
  id           bigint primary key,
  game_id      bigint not null,
  code         text not null,
  status       text not null default 'available',
  sold_to      bigint,
  sold_at      timestamptz,
  redeemed_at  timestamptz
);
create index if not exists licenses_game_idx on licenses(game_id, status);

create table if not exists price_history (
  id                bigint primary key,
  game_id           bigint not null,
  price             numeric not null,
  discount_percent  integer default 0,
  recorded_at       timestamptz not null default now()
);
create index if not exists price_history_game_idx on price_history(game_id, recorded_at desc);

create table if not exists bundles (
  id                bigint primary key,
  title             text not null,
  description       text,
  hero_image        text,
  discount_percent  integer not null default 0,
  starts_at         timestamptz,
  ends_at           timestamptz,
  is_active         boolean default true
);

create table if not exists bundle_games (
  bundle_id  bigint not null,
  game_id    bigint not null,
  primary key (bundle_id, game_id)
);

create table if not exists promotions (
  id            bigint primary key,
  title         text not null,
  subtitle      text,
  hero_image    text,
  accent_color  text,
  cta_text      text,
  cta_target    text,
  starts_at     timestamptz,
  ends_at       timestamptz,
  priority      integer default 0,
  is_active     boolean default true
);

create table if not exists promotion_games (
  promotion_id  bigint not null,
  game_id       bigint not null,
  primary key (promotion_id, game_id)
);

create table if not exists flash_sales (
  id                bigint primary key,
  game_id           bigint not null,
  discount_percent  integer not null,
  max_units         integer,
  starts_at         timestamptz,
  ends_at           timestamptz,
  is_daily_deal     boolean default false
);

create table if not exists collections (
  id            bigint primary key,
  slug          text unique not null,
  title         text not null,
  description   text,
  curator_name  text,
  hero_image    text
);

create table if not exists collection_games (
  collection_id  bigint not null,
  game_id        bigint not null,
  ord            integer default 0,
  primary key (collection_id, game_id)
);

create table if not exists orders (
  id                bigserial primary key,
  user_local_id     bigint not null,
  user_username     text not null,
  total             numeric not null,
  card_last4        text,
  card_brand        text,
  payment_provider  text,
  external_id       text,
  points_earned     integer default 0,
  points_used       integer default 0,
  promo_code        text,
  status            text default 'paid',
  created_at        timestamptz default now()
);

create table if not exists order_items (
  id              bigserial primary key,
  order_id        bigint not null references orders(id) on delete cascade,
  game_id         bigint not null,
  license_id      bigint,
  price           numeric not null,
  title_snapshot  text
);
create index if not exists order_items_order_idx on order_items(order_id);

-- Tabla shared para banderas (free-game-of-the-week, etc.)
create table if not exists app_settings (
  key         text primary key,
  value       jsonb,
  updated_at  timestamptz default now()
);
