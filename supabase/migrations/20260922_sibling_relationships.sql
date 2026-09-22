begin;
alter table public.family_relationships
  drop constraint if exists family_relationships_relationship_type_check;
alter table public.family_relationships
  add constraint family_relationships_relationship_type_check
  check (relationship_type in ('father', 'mother', 'spouse', 'older_sibling'));
create unique index if not exists family_sibling_unique
  on public.family_relationships
  (least(person_id, related_person_id), greatest(person_id, related_person_id))
  where relationship_type = 'older_sibling';
commit;
