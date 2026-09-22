begin;
create table if not exists public.family_registrations(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 home_id uuid references public.family_homes(id),person_id uuid references public.family_people(id),
 home_draft jsonb,person_draft jsonb,note text,status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),reviewed_by uuid references auth.users(id),review_note text
);
create unique index if not exists family_registration_pending on public.family_registrations(user_id) where status='pending';
alter table public.family_registrations enable row level security;
revoke all on public.family_registrations from public,anon,authenticated;
create or replace function public.family_member_approved() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (public.family_is_admin() or exists(select 1 from public.family_accounts where user_id=auth.uid()));
$$;
-- Preserve existing approved members and the existing implementations, but close all entry points to new accounts.
do $$ begin
 if to_regprocedure('public.family_dashboard_member()') is null then alter function public.family_dashboard() rename to family_dashboard_member; end if;
 if to_regprocedure('public.family_action_member(text,jsonb)') is null then alter function public.family_action(text,jsonb) rename to family_action_member; end if;
end $$;
create or replace function public.family_dashboard() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.family_member_approved() then raise exception 'กรุณาสมัครและรอ Admin อนุมัติ'; end if;
 return public.family_dashboard_member();
end $$;
create or replace function public.family_action(action text,payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.family_member_approved() then raise exception 'กรุณาสมัครและรอ Admin อนุมัติ'; end if;
 return public.family_action_member(action,payload);
end $$;
create or replace function public.family_registration_state() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'กรุณายืนยันอีเมล'; end if;
 return jsonb_build_object('approved',public.family_member_approved(),'request',
 (select to_jsonb(r) from public.family_registrations r where r.user_id=auth.uid() order by created_at desc limit 1));
end $$;
-- Minimal search projection after email verification; no addresses, birthdays, phones or relationships.
create or replace function public.family_registration_search(kind text,query text,selected_home uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'กรุณายืนยันอีเมล'; end if;
 if char_length(trim(query))<2 then return '[]'::jsonb; end if;
 if kind='home' then
 return coalesce((select jsonb_agg(to_jsonb(x)) from (select id,name from public.family_homes where strpos(lower(name),lower(trim(query)))>0 order by name limit 20)x),'[]');
 elsif kind='person' then
 return coalesce((select jsonb_agg(to_jsonb(x)) from (select p.id,p.full_name,p.home_id,h.name as home_name from public.family_people p join public.family_homes h on h.id=p.home_id
 where (selected_home is null or p.home_id=selected_home) and strpos(lower(concat_ws(' ',p.full_name,p.birth_first_name,p.birth_last_name,p.nickname)),lower(trim(query)))>0 order by p.full_name limit 20)x),'[]');
 end if;
 raise exception 'ประเภทการค้นหาไม่ถูกต้อง';
end $$;
create or replace function public.family_register(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare h uuid:=nullif(payload->>'home_id','')::uuid; p uuid:=nullif(payload->>'person_id','')::uuid; hd jsonb:=payload->'home_draft'; pd jsonb:=payload->'person_draft'; result uuid;
begin
 if auth.uid() is null then raise exception 'กรุณายืนยันอีเมล'; end if;
 perform pg_advisory_xact_lock(73921234);
 if public.family_member_approved() then raise exception 'บัญชีนี้เป็นสมาชิกแล้ว'; end if;
 if h is null then
  if coalesce(trim(hd->>'name'),'')='' or coalesce(trim(hd->>'province'),'')='' or coalesce(trim(hd->>'district'),'')='' or coalesce(trim(hd->>'subdistrict'),'')='' then raise exception 'กรุณากรอกข้อมูลบ้านให้ครบ'; end if;
  if exists(select 1 from public.family_homes where lower(trim(name))=lower(trim(hd->>'name'))) then raise exception 'มีชื่อบ้านนี้แล้ว กรุณาค้นหาและเลือกบ้านเดิม'; end if;
 elsif not exists(select 1 from public.family_homes where id=h) then raise exception 'ไม่พบบ้าน'; end if;
 if p is null then
  if coalesce(trim(pd->>'first_name'),'')='' or coalesce(pd->>'kinship_gender','') not in ('male','female') then raise exception 'กรุณาระบุชื่อและเพศ'; end if;
  if coalesce((payload->>'confirm_new_person')::boolean,false)=false then raise exception 'กรุณายืนยันว่าไม่พบชื่อของตนเองในระบบ'; end if;
 elsif not exists(select 1 from public.family_people where id=p and (h is null or home_id=h)) then raise exception 'บุคคลไม่ได้อยู่บ้านที่เลือก';
 elsif exists(select 1 from public.family_accounts where person_id=p) then raise exception 'ชื่อนี้ผูกบัญชีแล้ว กรุณาติดต่อ Admin'; end if;
 if octet_length(payload::text)>20000 then raise exception 'ข้อมูลยาวเกินกำหนด'; end if;
 insert into public.family_registrations(user_id,home_id,person_id,home_draft,person_draft,note)
 values(auth.uid(),h,p,case when h is null then hd end,case when p is null then pd end,left(payload->>'note',1000)) returning id into result;
 return result;
end $$;
create or replace function public.family_registration_admin(action text,request_id uuid default null,review_note text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.family_registrations%rowtype; h uuid;p uuid;hd jsonb;pd jsonb;
begin
 if auth.uid() is null or not public.family_is_admin() then raise exception 'เฉพาะ Admin'; end if;
 if action='list' then return coalesce((select jsonb_agg(to_jsonb(x)) from (select r.*,u.email,h.name as home_name,p.full_name from public.family_registrations r join auth.users u on u.id=r.user_id left join public.family_homes h on h.id=r.home_id left join public.family_people p on p.id=r.person_id where r.status='pending' order by r.created_at)x),'[]'); end if;
 perform pg_advisory_xact_lock(73921234);
 select * into r from public.family_registrations where id=request_id and status='pending' for update;
 if not found then raise exception 'ไม่พบคำขอที่รออนุมัติ'; end if;
 if action='approve' then
  if exists(select 1 from public.family_accounts where user_id=r.user_id) then raise exception 'บัญชีเป็นสมาชิกแล้ว'; end if;
  h:=r.home_id;p:=r.person_id;hd:=r.home_draft;pd:=r.person_draft;
  if h is null then
   if exists(select 1 from public.family_homes where lower(trim(name))=lower(trim(hd->>'name'))) then raise exception 'มีชื่อบ้านนี้แล้ว ให้ผู้สมัครเลือกบ้านเดิมและส่งใหม่'; end if;
   insert into public.family_homes(name,created_by,address_line,province,district,subdistrict,postal_code,phone,latitude,longitude)
   values(trim(hd->>'name'),r.user_id,hd->>'address_line',hd->>'province',hd->>'district',hd->>'subdistrict',hd->>'postal_code',hd->>'phone',nullif(hd->>'exact_latitude','')::numeric,nullif(hd->>'exact_longitude','')::numeric) returning id into h;
  end if;
  if p is null then
   if exists(select 1 from public.family_people where lower(regexp_replace(coalesce(first_name||coalesce(last_name,''),full_name),'\s','','g'))=lower(regexp_replace((pd->>'first_name')||coalesce(pd->>'last_name',''),'\s','','g'))) then raise exception 'พบชื่อซ้ำ ให้ตรวจสอบและเลือกบุคคลเดิมก่อนอนุมัติ'; end if;
   insert into public.family_people(owner_id,home_id,full_name,name_title,first_name,last_name,kinship_gender)
   values(r.user_id,h,trim(concat_ws(' ',nullif(pd->>'name_title',''),trim(pd->>'first_name'),nullif(trim(pd->>'last_name'),''))),pd->>'name_title',trim(pd->>'first_name'),nullif(trim(pd->>'last_name'),''),pd->>'kinship_gender') returning id into p;
  else
   if exists(select 1 from public.family_accounts where person_id=p) then raise exception 'บุคคลนี้ผูกบัญชีแล้ว'; end if;
   if r.home_id is not null and not exists(select 1 from public.family_people where id=p and home_id=h) then raise exception 'บุคคลย้ายบ้านแล้ว กรุณาส่งคำขอใหม่'; end if;
   update public.family_people set home_id=h where id=p;
   update public.family_homes set coordinator_id=null where coordinator_id=p and id<>h;
  end if;
  if r.home_id is null then update public.family_homes set coordinator_id=p where id=h; end if;
  insert into public.family_accounts(user_id,home_id,person_id) values(r.user_id,h,p);
  update public.family_registrations set status='approved',reviewed_by=auth.uid(),review_note=left(family_registration_admin.review_note,1000),home_id=h,person_id=p where id=r.id;
 elsif action='reject' then
  update public.family_registrations set status='rejected',reviewed_by=auth.uid(),review_note=left(family_registration_admin.review_note,1000) where id=r.id;
 else raise exception 'คำสั่งไม่ถูกต้อง'; end if;
 return jsonb_build_object('success',true);
end $$;
revoke all on function public.family_member_approved(),public.family_dashboard_member(),public.family_action_member(text,jsonb),public.family_dashboard(),public.family_action(text,jsonb),public.family_registration_state(),public.family_registration_search(text,text,uuid),public.family_register(jsonb),public.family_registration_admin(text,uuid,text) from public,anon,authenticated;
grant execute on function public.family_dashboard(),public.family_action(text,jsonb),public.family_registration_state(),public.family_registration_search(text,text,uuid),public.family_register(jsonb),public.family_registration_admin(text,uuid,text) to authenticated;
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
  update public.family_registrations r set home_id=target_home_id where r.home_id=family_delete_home.home_id;
 elsif exists(select 1 from public.family_people p where p.home_id=family_delete_home.home_id)
  or exists(select 1 from public.family_accounts a where a.home_id=family_delete_home.home_id)
  or exists(select 1 from public.family_join_requests r where r.home_id=family_delete_home.home_id)
  or exists(select 1 from public.family_registrations r where r.home_id=family_delete_home.home_id) then
  raise exception 'บ้านนี้มีสมาชิก บัญชี หรือคำขอ กรุณาเลือกบ้านปลายทางเพื่อย้ายก่อนลบ';
 end if;
 delete from public.family_homes h where h.id=family_delete_home.home_id;
end $$;

notify pgrst,'reload schema';
commit;
