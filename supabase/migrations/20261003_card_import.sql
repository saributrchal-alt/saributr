begin;
create table if not exists public.family_identity_private (
 person_id uuid primary key references public.family_people(id) on delete cascade,
 citizen_id text not null unique check(citizen_id ~ '^[0-9]{13}$'),
 updated_at timestamptz not null default now()
);
alter table public.family_identity_private enable row level security;
revoke all on public.family_identity_private from public,anon,authenticated;
create or replace function public.family_card_match(citizen_id text) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 if not public.family_member_approved() or not public.family_is_admin() then raise exception 'เฉพาะ Admin เท่านั้น'; end if;
 return (select i.person_id from public.family_identity_private i where i.citizen_id=family_card_match.citizen_id);
end $$;
create or replace function public.family_import_person(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cid text; target uuid; matched uuid; previous text; saved jsonb; original jsonb;
begin
 if not public.family_member_approved() or not public.family_is_admin() then raise exception 'เฉพาะ Admin เท่านั้น'; end if;
 cid:=payload->>'citizen_id';
 if cid is null or cid !~ '^[0-9]{13}$' then raise exception 'เลขประจำตัวประชาชนต้องมี 13 หลัก'; end if;
 perform pg_advisory_xact_lock(hashtextextended('family-card-import',0));
 target:=nullif(payload->>'id','')::uuid;
 select i.person_id into matched from public.family_identity_private i where i.citizen_id=cid;
 if matched is not null and matched is distinct from target then raise exception 'เลขบัตรนี้ผูกกับสมาชิกแล้ว กรุณาเลือกสมาชิกเดิม'; end if;
 if target is not null then
  select to_jsonb(p) into original from public.family_people p where p.id=target for update;
  if original is null then raise exception 'ไม่พบสมาชิก'; end if;
  select i.citizen_id into previous from public.family_identity_private i where i.person_id=target;
  if previous is not null and previous<>cid then raise exception 'สมาชิกนี้มีเลขบัตรอื่นอยู่แล้ว กรุณาตรวจสอบบุคคล'; end if;
  payload:=original||payload;
 end if;
 saved:=public.family_action('save_person',payload-'citizen_id');
 insert into public.family_identity_private(person_id,citizen_id) values((saved->>'id')::uuid,cid)
 on conflict(person_id) do update set citizen_id=excluded.citizen_id,updated_at=now();
 return saved;
end $$;
create or replace function public.family_private_details(person_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not public.family_member_approved() or not (public.family_is_admin() or exists(select 1 from public.family_accounts a where a.user_id=auth.uid() and a.person_id=family_private_details.person_id)) then raise exception 'ไม่มีสิทธิ์ดูข้อมูลส่วนตัว'; end if;
 return (select jsonb_build_object('birth_date',p.birth_date,'phone',p.phone,'citizen_id',i.citizen_id) from public.family_people p left join public.family_identity_private i on i.person_id=p.id where p.id=family_private_details.person_id);
end $$;
revoke all on function public.family_card_match(text),public.family_import_person(jsonb),public.family_private_details(uuid) from public,anon,authenticated;
grant execute on function public.family_card_match(text),public.family_import_person(jsonb),public.family_private_details(uuid) to authenticated;
commit;
