-- Expose only the linked LINE picture to approved directory members.
create or replace function public.family_dashboard() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.family_member_approved() then raise exception 'กรุณารออนุมัติสมาชิก'; end if;
 result := public.family_dashboard_member();
 return jsonb_set(result, '{people}', coalesce((
  select jsonb_agg(person.value || jsonb_build_object('avatar_url', (
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
