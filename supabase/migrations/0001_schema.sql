-- AI Musical Chair: tables (TRD › Database). Game logic lives in 0003_rpc.sql.

create extension if not exists unaccent with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;

-- Admins ---------------------------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- The single game ------------------------------------------------------------
create table public.games (
  id smallint primary key default 1 check (id = 1),
  name text not null default 'AI Musical Chair' check (char_length(name) between 1 and 60),
  status text not null default 'lobby' check (status in ('lobby', 'in_round', 'round_complete', 'finished')),
  registration_open boolean not null default true,
  final_chair_count int not null default 3 check (final_chair_count between 1 and 100),
  timer_seconds int not null default 30 check (timer_seconds between 5 and 300),
  auto_open_on_pause boolean not null default true,
  current_round_id uuid,
  updated_at timestamptz not null default now()
);
insert into public.games default values;

-- Players --------------------------------------------------------------------
create table public.players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 40 and name ~ '^[A-Za-z][A-Za-z .''-]*$'),
  usn text not null unique check (usn ~ '^[0-9A-Z]{6,12}$'),
  phone text not null unique check (phone ~ '^[0-9]{10}$'),
  branch text not null check (char_length(branch) between 1 and 40),
  status text not null default 'active' check (status in ('active', 'eliminated', 'winner', 'spectator', 'kicked')),
  eliminated_in_round int,
  final_rank int,
  created_at timestamptz not null default now()
);

-- Chairs (any number; admin adds/deletes freely) ------------------------------
create table public.chairs (
  id uuid primary key default gen_random_uuid(),
  number int not null unique check (number > 0),
  secret text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Rounds and spins -------------------------------------------------------------
create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  number int not null unique check (number > 0),
  difficulty int not null check (difficulty between 1 and 5),
  timer_seconds int not null check (timer_seconds between 5 and 300),
  is_final boolean not null default false,
  status text not null default 'active' check (status in ('active', 'complete')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

alter table public.games
  add constraint games_current_round_fk foreign key (current_round_id) references public.rounds (id) on delete set null;

create table public.spins (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  number int not null check (number > 0),
  phase text not null default 'music' check (phase in ('music', 'scan_open', 'judging', 'closed')),
  scan_opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (round_id, number)
);

-- Questions --------------------------------------------------------------------
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) between 5 and 300),
  type text not null check (type in ('mcq', 'one_word')),
  options jsonb,
  answer text not null check (char_length(answer) between 1 and 80),
  alternatives text[] not null default '{}',
  difficulty int not null check (difficulty between 1 and 5),
  topic text not null default 'general' check (char_length(topic) between 1 and 60),
  source text not null default 'manual' check (source in ('manual', 'csv', 'ai', 'seed')),
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  -- MCQ: 2-6 string options and the answer is one of them. One word: no options.
  constraint questions_shape check (
    (type = 'mcq' and jsonb_typeof(options) = 'array'
      and jsonb_array_length(options) between 2 and 6 and options ? answer)
    or (type = 'one_word' and options is null)
  )
);
create index questions_pick_idx on public.questions (difficulty) where is_enabled;

-- Attempts (one scan = one attempt) -----------------------------------------------
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  spin_id uuid not null references public.spins (id) on delete cascade,
  round_id uuid not null references public.rounds (id) on delete cascade,
  chair_id uuid not null references public.chairs (id),
  player_id uuid not null references public.players (id) on delete cascade,
  question_id uuid not null references public.questions (id),
  scanned_at timestamptz not null default now(),
  deadline timestamptz not null,
  answered_at timestamptz,
  answer text check (char_length(answer) <= 100),
  result text not null default 'pending' check (result in ('pending', 'correct', 'wrong', 'timed_out')),
  time_ms int,
  overridden boolean not null default false,
  unique (spin_id, chair_id),
  unique (spin_id, player_id)
);
-- A chair is held by at most one correct answer per round, and a player holds at most one chair.
create unique index attempts_one_lock_per_chair on public.attempts (round_id, chair_id) where result = 'correct';
create unique index attempts_one_lock_per_player on public.attempts (round_id, player_id) where result = 'correct';
create index attempts_player_idx on public.attempts (player_id, round_id);

-- Anti-cheat alerts ------------------------------------------------------------------
create table public.alerts (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players (id) on delete cascade,
  attempt_id uuid references public.attempts (id) on delete cascade,
  kind text not null check (kind in ('away_start', 'away_end')),
  away_ms int check (away_ms between 0 and 3600000),
  acknowledged boolean not null default false,
  created_at timestamptz not null default now()
);
create index alerts_attempt_idx on public.alerts (attempt_id);

-- Public projection read by players and the projector -----------------------------------
create table public.public_state (
  id smallint primary key default 1 check (id = 1),
  data jsonb not null default '{}',
  event_seq bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.public_state default values;

-- Audit and rate limiting --------------------------------------------------------------
create table public.admin_audit (
  id bigint generated always as identity primary key,
  admin_id uuid not null,
  action text not null,
  target text,
  reason text,
  at timestamptz not null default now()
);

create table public.ai_requests (
  id bigint generated always as identity primary key,
  admin_id uuid not null,
  at timestamptz not null default now()
);
create index ai_requests_admin_at on public.ai_requests (admin_id, at);
