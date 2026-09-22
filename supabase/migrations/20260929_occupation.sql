alter table public.family_people add column if not exists occupation text check (char_length(occupation)<=200);

-- Expose only the linked LINE picture to approved directory members.
create or replace function public.family_dashboard() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.family_member_approved() then raise exception 'กรุณารออนุมัติสมาชิก'; end if;
 result := public.family_dashboard_member();
 return jsonb_set(result, '{people}', coalesce((
  select jsonb_agg((case when exists(select 1 from public.family_accounts own where own.user_id=auth.uid() and own.person_id=(person.value->>'id')::uuid) then person.value else person.value - 'birth_date' - 'phone' end) || jsonb_build_object('occupation', (select p.occupation from public.family_people p where p.id=(person.value->>'id')::uuid), 'avatar_url', (
   select coalesce(nullif(i.identity_data->>'picture',''),i.identity_data->>'avatar_url')
   from public.family_accounts a join auth.identities i on i.user_id=a.user_id
   where a.person_id=(person.value->>'id')::uuid
    and i.provider in ('custom:line-oauth','custom:line')
    and coalesce(nullif(i.identity_data->>'picture',''),i.identity_data->>'avatar_url') like 'https://%'
   order by case when i.provider='custom:line-oauth' then 0 else 1 end
   limit 1
  )) order by person.position)
  from jsonb_array_elements(result->'people') with ordinality as person(value,position)
 ), '[]'::jsonb));
end $$;
revoke all on function public.family_dashboard() from public,anon,authenticated;
grant execute on function public.family_dashboard() to authenticated;

create or replace function public.family_private_details(person_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.family_member_approved() or not (public.family_is_admin() or exists(select 1 from public.family_accounts a where a.user_id=auth.uid() and a.person_id=family_private_details.person_id)) then raise exception 'ไม่มีสิทธิ์ดูข้อมูลส่วนตัว'; end if;
 return (select jsonb_build_object('birth_date',p.birth_date,'phone',p.phone) from public.family_people p where p.id=family_private_details.person_id);
end $$;
revoke all on function public.family_private_details(uuid) from public,anon,authenticated;
grant execute on function public.family_private_details(uuid) to authenticated;

-- Preserve hidden fields when another household member edits the public profile.
create or replace function public.family_action(action text,payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid; original jsonb; saved jsonb;
begin
 if not public.family_member_approved() then raise exception 'กรุณาสมัครและรอ Admin อนุมัติ'; end if;
 if action='save_person' and nullif(payload->>'id','') is not null then
  target:=(payload->>'id')::uuid;
  if not public.family_person_edit(target) then raise exception 'ไม่มีสิทธิ์แก้ไขบุคคลนี้'; end if;
  select jsonb_build_object('birth_date',p.birth_date,'phone',p.phone) into original from public.family_people p where p.id=target for update;
  if not public.family_is_admin() and not exists(select 1 from public.family_accounts a where a.user_id=auth.uid() and a.person_id=target) then
   payload:=(payload - 'birth_date' - 'phone') || original;
  else
   payload:=original || payload;
  end if;
 end if;
 saved:=public.family_action_member(action,payload);
 if action='save_person' and payload ? 'occupation' then
  update public.family_people set occupation=nullif(trim(payload->>'occupation'),'') where id=(saved->>'id')::uuid;
 end if;
 return saved;
end $$;
revoke all on function public.family_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.family_action(text,jsonb) to authenticated;
