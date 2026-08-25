-- New Town Properties — shared backend schema.
--
-- One table. Every piece of app state (rent-roll edits, expenses, the tax
-- worksheet) is a JSON document under a well-known key, so adding a feature
-- never needs a migration.
--
-- Run this once in the Supabase SQL editor.

create table if not exists app_state (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table app_state enable row level security;

-- Anyone holding the project's anon key may read and write. That key is baked
-- into the page, so treat the URL as the credential: give it only to the people
-- who should see the portfolio. Add Supabase Auth later if you want per-user
-- logins and an edit history tied to real accounts.
drop policy if exists app_state_read on app_state;
create policy app_state_read on app_state for select using (true);

drop policy if exists app_state_write on app_state;
create policy app_state_write on app_state for insert with check (true);

drop policy if exists app_state_update on app_state;
create policy app_state_update on app_state for update using (true) with check (true);

-- Keep a rolling history so a bad edit can be recovered.
create table if not exists app_state_history (
  id          bigserial primary key,
  key         text not null,
  value       jsonb not null,
  saved_at    timestamptz not null default now()
);

alter table app_state_history enable row level security;
drop policy if exists history_read on app_state_history;
create policy history_read on app_state_history for select using (true);
drop policy if exists history_write on app_state_history;
create policy history_write on app_state_history for insert with check (true);

create or replace function snapshot_app_state() returns trigger
language plpgsql as $$
begin
  insert into app_state_history (key, value) values (old.key, old.value);
  return new;
end $$;

drop trigger if exists app_state_snapshot on app_state;
create trigger app_state_snapshot before update on app_state
  for each row execute function snapshot_app_state();
