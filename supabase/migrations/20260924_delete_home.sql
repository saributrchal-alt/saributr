begin;
create or replace function public.family_delete_home(home_id uuid, target_home_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.family_is_admin() then raise exception 'เฉพาะ Admin เท่านั้น'; end if;
 perform pg_advisory_xact_lock(73921234);
 if not exists(select 1 from public.family_homes h where h.id=home_id) then raise exception 'ไม่พบบ้าน'; end if;
 if target_home_id is not null then
  if target_home_id=home_id or not exists(select 1 from public.family_homes h where h.id=target_home_id) then raise exception 'กรุณาเลือกบ้านปลายทางอื่นที่มีอยู่'; end if;
  update public.family_people p set home_id=target_home_id where p.home_id=family_delete_home.home_id;
  update public.family_accounts a set home_id=target_home_id where a.home_id=family_delete_home.home_id;
  update public.family_join_requests r set home_id=target_home_id where r.home_id=family_delete_home.home_id;
 elsif exists(select 1 from public.family_people p where p.home_id=family_delete_home.home_id)
  or exists(select 1 from public.family_accounts a where a.home_id=family_delete_home.home_id)
  or exists(select 1 from public.family_join_requests r where r.home_id=family_delete_home.home_id) then
  raise exception 'บ้านนี้มีสมาชิก บัญชี หรือคำขอ กรุณาเลือกบ้านปลายทางเพื่อย้ายก่อนลบ';
 end if;
 delete from public.family_homes h where h.id=family_delete_home.home_id;
end $$;
revoke all on function public.family_delete_home(uuid,uuid) from public,anon,authenticated;
grant execute on function public.family_delete_home(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
