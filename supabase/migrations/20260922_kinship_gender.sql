alter table public.family_people
  add column if not exists kinship_gender text
  check (kinship_gender in ('male', 'female'));
