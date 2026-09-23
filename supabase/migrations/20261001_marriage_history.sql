alter table public.family_relationships add column if not exists marriage_status text not null default 'unknown' check(marriage_status in ('unknown','married','divorced','widowed'));
alter table public.family_relationships add column if not exists married_on date;
alter table public.family_relationships add column if not exists ended_on date;
alter table public.family_relationships add column if not exists marriage_note text check(char_length(marriage_note)<=1000);
DO $$ begin
 if not exists(select 1 from pg_constraint where conname='family_marriage_dates') then
 alter table public.family_relationships add constraint family_marriage_dates check(ended_on is null or married_on is null or ended_on>=married_on);
 end if;
end $$;
-- Return only relative age order, never hidden birth dates. Equal dates share a rank.
create or replace function public.family_dashboard() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.family_member_approved() then raise exception 'กรุณารออนุมัติสมาชิก'; end if;
 result := public.family_dashboard_member();
 result:=jsonb_set(result,'{relations}',coalesce((select jsonb_agg(item.value || jsonb_build_object('marriage_status',r.marriage_status,'married_on',r.married_on,'ended_on',r.ended_on,'marriage_note',r.marriage_note)) from jsonb_array_elements(result->'relations') item(value) join public.family_relationships r on r.id=(item.value->>'id')::uuid),'[]'::jsonb));
 return jsonb_set(result, '{people}', coalesce((
  select jsonb_agg((case when exists(select 1 from public.family_accounts own where own.user_id=auth.uid() and own.person_id=(person.value->>'id')::uuid) then person.value else person.value - 'birth_date' - 'phone' end) || jsonb_build_object('age_order', (select ranked.position from (select id,dense_rank() over(order by birth_date) as position from public.family_people where birth_date is not null) ranked where ranked.id=(person.value->>'id')::uuid), 'occupation', (select p.occupation from public.family_people p where p.id=(person.value->>'id')::uuid), 'avatar_url', (
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


create or replace function public.family_action(action text,payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid; original jsonb; saved jsonb; rel public.family_relationships; other_id uuid; child_id uuid; other_role text;
begin
 if not public.family_member_approved() then raise exception 'กรุณาสมัครและรอ Admin อนุมัติ'; end if;
 if action='marriage' then
  select * into rel from public.family_relationships where id=(payload->>'id')::uuid for update;
  if not found or rel.relationship_type<>'spouse' or not public.family_link_allowed(rel.person_id,rel.related_person_id,'spouse') then raise exception 'ไม่มีสิทธิ์แก้ไขการสมรส'; end if;
  update public.family_relationships set marriage_status=coalesce(payload->>'marriage_status','unknown'),married_on=nullif(payload->>'married_on','')::date,ended_on=nullif(payload->>'ended_on','')::date,marriage_note=nullif(trim(payload->>'marriage_note'),'') where id=rel.id;
  return jsonb_build_object('id',rel.id);
 end if;
 if action='save_person'  and nullif(payload->>'id','') is not null then
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
 if (action='save_person' and payload->>'link_role'='child') or (action='link' and payload->>'relationship_type' in ('father','mother')) then
  other_id:=nullif(payload->>'other_parent_id','')::uuid;
  if other_id is not null then
   child_id:=case when action='save_person' then (saved->>'id')::uuid else (payload->>'related_person_id')::uuid end;
   other_role:=case when coalesce(payload->>'parent_role',payload->>'relationship_type')='father' then 'mother' else 'father' end;
   if not exists(select 1 from public.family_relationships where person_id=other_id and related_person_id=child_id and relationship_type=other_role) then
    perform public.family_action_member('link',jsonb_build_object('person_id',other_id,'related_person_id',child_id,'relationship_type',other_role));
   end if;
  end if;
 end if;
 return saved;
end $$;
revoke all on function public.family_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.family_action(text,jsonb) to authenticated;
