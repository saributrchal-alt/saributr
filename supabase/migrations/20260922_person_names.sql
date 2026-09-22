begin;
alter table public.family_people
  add column if not exists name_title text,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists birth_first_name text,
  add column if not exists birth_last_name text;
commit;
