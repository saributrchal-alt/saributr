-- Return only relative age order, never hidden birth dates. Equal dates share a rank.
create or replace function public.family_dashboard() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.family_member_approved() then raise exception 'กรุณารออนุมัติสมาชิก'; end if;
 result := public.family_dashboard_member();
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

