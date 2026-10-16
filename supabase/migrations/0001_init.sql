-- 好きな場所Bot の初期スキーマ

create extension if not exists "pgcrypto";

-- ============================================================
-- line_users: LINEユーザーごとの会話状態
-- ============================================================
create table line_users (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null unique,
  display_name text,
  state text not null default 'idle'
    check (state in ('idle', 'awaiting_location', 'registered')),
  current_place_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- places: 登録された場所
-- ============================================================
create table places (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null references line_users (line_user_id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  address text,
  title text,
  created_at timestamptz not null default now()
);

create index places_line_user_id_idx on places (line_user_id);
create index places_created_at_idx on places (created_at);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger line_users_set_updated_at
  before update on line_users
  for each row execute function set_updated_at();

-- line_users.current_place_id -> places.id
-- (places を先に作る必要があるため、FKはテーブル作成後に追加する)
alter table line_users
  add constraint line_users_current_place_id_fkey
  foreign key (current_place_id) references places (id) on delete set null;

-- ============================================================
-- place_photos: 場所に紐づく写真
-- ============================================================
create table place_photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places (id) on delete cascade,
  storage_path text not null,
  content_type text not null default 'image/jpeg',
  created_at timestamptz not null default now()
);

create index place_photos_place_id_idx on place_photos (place_id);

-- ============================================================
-- place_comments: 場所に紐づくコメント
-- ============================================================
create table place_comments (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index place_comments_place_id_idx on place_comments (place_id);

-- ============================================================
-- RLS: 4テーブルとも有効化するが、anon/authenticated 向けの
-- ポリシーは意図的に定義しない（ポリシー0件 = 全拒否）。
-- データアクセスは service_role を使う Next.js の API Route
-- からのみに一本化する。
-- ============================================================
-- #@@range_begin(wow_rls)
alter table line_users enable row level security;
alter table places enable row level security;
alter table place_photos enable row level security;
alter table place_comments enable row level security;
-- #@@range_end(wow_rls)

-- ============================================================
-- Storage: 写真用バケット（private）
-- ============================================================
insert into storage.buckets (id, name, public)
values ('place-photos', 'place-photos', false)
on conflict (id) do nothing;
