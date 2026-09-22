-- Run once in Supabase SQL Editor, after the earlier person-name migrations.
-- No existing people or relationships are deleted. All changes are transactional.
begin;
create table if not exists public.family_homes (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(trim(name)) between 1 and 200),
 created_by uuid not null references auth.users(id),
 legacy_owner uuid unique references auth.users(id),
 address_line text, subdistrict text, district text, province text, postal_code text,
 phone text, coordinator_id uuid references public.family_people(id) on delete set null,
 latitude numeric check(latitude between -90 and 90), longitude numeric check(longitude between -180 and 180),
 created_at timestamptz not null default now(),
 check ((latitude is null) = (longitude is null))
);
alter table public.family_people add column if not exists home_id uuid references public.family_homes(id);
alter table public.family_people add column if not exists phone text;
alter table public.family_people add column if not exists current_address text;
create table if not exists public.family_admins (user_id uuid primary key references auth.users(id) on delete cascade);
create table if not exists public.family_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 home_id uuid not null references public.family_homes(id),
 person_id uuid unique references public.family_people(id) on delete set null
);
create table if not exists public.family_join_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 home_id uuid not null references public.family_homes(id), person_id uuid references public.family_people(id) on delete cascade,
 note text, status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(), reviewed_by uuid references auth.users(id)
);
create unique index if not exists family_one_pending_request on public.family_join_requests(user_id) where status='pending';
create index if not exists family_people_home_idx on public.family_people(home_id);
-- Existing owners retain editing rights to their own migrated household; identity is NOT guessed.
insert into public.family_homes(name,created_by,legacy_owner)
 select 'บ้านครอบครัวของฉัน', owner_id, owner_id from public.family_people where home_id is null group by owner_id
 on conflict(legacy_owner) do nothing;
update public.family_people p set home_id=h.id from public.family_homes h where p.owner_id=h.legacy_owner and p.home_id is null;
insert into public.family_accounts(user_id,home_id)
 select legacy_owner,id from public.family_homes where legacy_owner is not null on conflict(user_id) do nothing;
-- Replace same-owner composite foreign keys with person IDs: cross-home links are checked by RPC.
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.family_relationships'::regclass and contype='f' and confrelid='public.family_people'::regclass
 loop execute format('alter table public.family_relationships drop constraint %I',c.conname); end loop;
end $$;
alter table public.family_relationships add constraint family_relation_person_fk foreign key(person_id) references public.family_people(id) on delete cascade;
alter table public.family_relationships add constraint family_relation_related_fk foreign key(related_person_id) references public.family_people(id) on delete cascade;

-- Private helpers have no client execute privileges.
create or replace function public.family_is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.family_admins where user_id=auth.uid());
$$;
create or replace function public.family_home_edit(h uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (public.family_is_admin() or exists(select 1 from public.family_accounts where user_id=auth.uid() and home_id=h));
$$;
create or replace function public.family_person_edit(p uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.family_people x where x.id=p and (public.family_home_edit(x.home_id) or exists(select 1 from public.family_accounts a where a.user_id=auth.uid() and a.person_id=x.id)));
$$;
create or replace function public.family_link_allowed(a uuid,b uuid,t text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and a<>b and exists(
 select 1 from public.family_people x join public.family_people y on y.id=b where x.id=a and (
 public.family_is_admin() or (t in ('father','mother','spouse') and (
 (x.home_id=y.home_id and public.family_home_edit(x.home_id)) or
 exists(select 1 from public.family_accounts me where me.user_id=auth.uid() and
 ((t in ('father','mother') and me.person_id=b) or (t='spouse' and me.person_id in(a,b))))
 ))));
$$;

-- Return an explicit public projection, with private fields only for authorized households.
create or replace function public.family_dashboard() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; begin
 if auth.uid() is null then raise exception 'กรุณาเข้าสู่ระบบ'; end if;
 select jsonb_build_object(
 'is_admin',public.family_is_admin(),
 'account',(select jsonb_build_object('home_id',home_id,'person_id',person_id) from public.family_accounts where user_id=auth.uid()),
 'homes',coalesce((select jsonb_agg(jsonb_build_object(
 'id',h.id,'name',h.name,'province',h.province,'district',h.district,'can_edit',public.family_home_edit(h.id),
 'latitude',round(h.latitude,2),'longitude',round(h.longitude,2),
 'member_count',(select count(*) from public.family_people p where p.home_id=h.id)) ||
 case when public.family_home_edit(h.id) then jsonb_build_object('address_line',h.address_line,'subdistrict',h.subdistrict,'postal_code',h.postal_code,'phone',h.phone,'coordinator_id',h.coordinator_id,'exact_latitude',h.latitude,'exact_longitude',h.longitude) else '{}'::jsonb end order by h.name) from public.family_homes h),'[]'::jsonb),
 'people',coalesce((select jsonb_agg(jsonb_build_object(
 'id',p.id,'home_id',p.home_id,'full_name',p.full_name,'name_title',p.name_title,'first_name',p.first_name,'last_name',p.last_name,
 'birth_first_name',p.birth_first_name,'birth_last_name',p.birth_last_name,'nickname',p.nickname,'kinship_gender',p.kinship_gender,'can_edit',public.family_person_edit(p.id)) ||
 case when public.family_person_edit(p.id) then jsonb_build_object('birth_date',p.birth_date,'death_date',p.death_date,'birthplace',p.birthplace,'biography',p.biography,'phone',p.phone,'current_address',p.current_address) else '{}'::jsonb end order by p.created_at) from public.family_people p),'[]'::jsonb),
 'relations',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'person_id',r.person_id,'related_person_id',r.related_person_id,'relationship_type',r.relationship_type,'can_edit',public.family_link_allowed(r.person_id,r.related_person_id,r.relationship_type))) from public.family_relationships r),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'user_id',r.user_id,'home_id',r.home_id,'person_id',r.person_id,'note',r.note,'status',r.status,'created_at',r.created_at,'email',case when public.family_is_admin() then u.email else null end) order by r.created_at desc) from public.family_join_requests r join auth.users u on u.id=r.user_id where public.family_is_admin() or r.user_id=auth.uid()),'[]'::jsonb)
 ) into result;
 return result;
end $$;

-- One transaction per operation. Client-supplied owner IDs / roles are never accepted.
create or replace function public.family_action(action text,payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); admin boolean; v_id uuid; h uuid; a uuid; b uuid; t text;
 p public.family_people%rowtype; req public.family_join_requests%rowtype;
 title text; firstn text; lastn text; fulln text; coord uuid;
begin
 if uid is null then raise exception 'กรุณาเข้าสู่ระบบ'; end if;
 admin:=public.family_is_admin();
 -- Serialize mutations to protect cycle / duplicate / membership checks from concurrent requests.
 perform pg_advisory_xact_lock(73921234);
 if action='save_home' then
  v_id:=nullif(payload->>'id','')::uuid;
  if v_id is null then
   if not admin and exists(select 1 from public.family_accounts where user_id=uid) then raise exception 'บัญชีนี้มีบ้านแล้ว'; end if;
   insert into public.family_homes(name,created_by) values(trim(payload->>'name'),uid) returning family_homes.id into v_id;
   if not admin or not exists(select 1 from public.family_accounts where user_id=uid) then
    insert into public.family_accounts(user_id,home_id) values(uid,v_id);
   end if;
  elsif not public.family_home_edit(v_id) then raise exception 'ไม่มีสิทธิ์แก้ไขบ้านนี้'; end if;
  coord:=nullif(payload->>'coordinator_id','')::uuid;
  if coord is not null and not exists(select 1 from public.family_people where family_people.id=coord and home_id=v_id) then raise exception 'ผู้ประสานงานต้องเป็นสมาชิกในบ้าน'; end if;
  update public.family_homes set name=trim(payload->>'name'),address_line=nullif(trim(payload->>'address_line'),''),
   subdistrict=nullif(trim(payload->>'subdistrict'),''),district=nullif(trim(payload->>'district'),''),province=nullif(trim(payload->>'province'),''),
   postal_code=nullif(trim(payload->>'postal_code'),''),phone=nullif(trim(payload->>'phone'),''),coordinator_id=coord,
   latitude=nullif(payload->>'exact_latitude','')::numeric,longitude=nullif(payload->>'exact_longitude','')::numeric where family_homes.id=v_id;
 elsif action='request_join' then
  h:=(payload->>'home_id')::uuid; a:=nullif(payload->>'person_id','')::uuid;
  if not exists(select 1 from public.family_homes where family_homes.id=h) then raise exception 'ไม่พบบ้าน'; end if;
  if a is not null and not exists(select 1 from public.family_people where family_people.id=a and home_id=h) then raise exception 'บุคคลไม่ได้อยู่บ้านนี้'; end if;
  if a is not null and exists(select 1 from public.family_accounts where person_id=a and user_id<>uid) then raise exception 'บุคคลนี้ผูกบัญชีแล้ว กรุณาติดต่อ Admin'; end if;
  insert into public.family_join_requests(user_id,home_id,person_id,note) values(uid,h,a,left(payload->>'note',1000)) returning family_join_requests.id into v_id;
 elsif action='review_request' then
  if not admin then raise exception 'เฉพาะ Admin'; end if;
  select * into req from public.family_join_requests where family_join_requests.id=(payload->>'id')::uuid and status='pending' for update;
  if not found then raise exception 'ไม่พบคำขอที่รอตรวจสอบ'; end if;
  if payload->>'decision'='approved' then
   if req.person_id is not null and not exists(select 1 from public.family_people where family_people.id=req.person_id and home_id=req.home_id) then raise exception 'ข้อมูลบ้านเปลี่ยน กรุณาส่งคำขอใหม่'; end if;
   insert into public.family_accounts(user_id,home_id,person_id) values(req.user_id,req.home_id,req.person_id)
    on conflict(user_id) do update set home_id=excluded.home_id,person_id=excluded.person_id;
  elsif payload->>'decision'<>'rejected' then raise exception 'สถานะไม่ถูกต้อง'; end if;
  update public.family_join_requests set status=payload->>'decision',reviewed_by=uid where family_join_requests.id=req.id; v_id:=req.id;
 elsif action='save_person' then
  v_id:=nullif(payload->>'id','')::uuid; h:=(payload->>'home_id')::uuid;
  if v_id is null then
   if not public.family_home_edit(h) then raise exception 'เพิ่มบุคคลได้เฉพาะบ้านตนเอง'; end if;
  else
   select * into p from public.family_people where family_people.id=v_id for update;
   if not found or not public.family_person_edit(v_id) then raise exception 'ไม่มีสิทธิ์แก้ไขบุคคลนี้'; end if;
   if h is distinct from p.home_id and not admin then raise exception 'เฉพาะ Admin ย้ายบ้านให้บุคคลได้'; end if;
  end if;
  title:=coalesce(trim(payload->>'name_title'),'');firstn:=trim(payload->>'first_name');lastn:=coalesce(trim(payload->>'last_name'),'');
  if coalesce(firstn,'')='' then raise exception 'กรุณาระบุชื่อ'; end if;
  if coalesce(payload->>'kinship_gender','') not in ('male','female') then raise exception 'กรุณาเลือกเพศ'; end if;
  fulln:=trim(concat_ws(' ',nullif(title,''),firstn,nullif(lastn,'')));
  if v_id is null and coalesce((payload->>'confirm_distinct')::boolean,false)=false and exists(
    select 1 from public.family_people x where lower(regexp_replace(coalesce(x.first_name||' '||coalesce(x.last_name,''),x.full_name),'\s','','g'))=lower(regexp_replace(firstn||lastn,'\s','','g'))
    or lower(regexp_replace(x.full_name,'\s','','g'))=lower(regexp_replace(fulln,'\s','','g'))
   ) then raise exception 'พบชื่อซ้ำ กรุณาเลือกบุคคลเดิม หรือยืนยันว่าเป็นคนละบุคคล'; end if;
  if v_id is null then
   insert into public.family_people(owner_id,home_id,full_name) values(uid,h,fulln) returning family_people.id into v_id;
  end if;
  update public.family_people set home_id=h,full_name=fulln,name_title=title,first_name=firstn,last_name=nullif(lastn,''),
   birth_first_name=nullif(trim(payload->>'birth_first_name'),''),birth_last_name=nullif(trim(payload->>'birth_last_name'),''),nickname=nullif(trim(payload->>'nickname'),''),
   kinship_gender=payload->>'kinship_gender',birth_date=nullif(payload->>'birth_date','')::date,death_date=nullif(payload->>'death_date','')::date,
   birthplace=nullif(trim(payload->>'birthplace'),''),biography=nullif(trim(payload->>'biography'),''),phone=nullif(trim(payload->>'phone'),''),current_address=nullif(trim(payload->>'current_address'),'') where family_people.id=v_id;
  if admin and p.home_id is distinct from h then
   update public.family_accounts set home_id=h where person_id=v_id;
   update public.family_homes set coordinator_id=null where coordinator_id=v_id and family_homes.id<>h;
  end if;
  -- Optional create + link is atomic. A rejected link rolls back the new person too.
  if payload->>'link_anchor' is not null then
   a:=(payload->>'link_anchor')::uuid;t:=payload->>'link_role';
   if t='father' or t='mother' then
    perform public.family_action('link',jsonb_build_object('person_id',v_id,'related_person_id',a,'relationship_type',t));
   elsif t='spouse' then
    perform public.family_action('link',jsonb_build_object('person_id',a,'related_person_id',v_id,'relationship_type','spouse'));
   elsif t='child' then
    t:=payload->>'parent_role';
    if t not in ('father','mother') or t is null then raise exception 'กรุณาระบุบทบาทพ่อหรือแม่'; end if;
    perform public.family_action('link',jsonb_build_object('person_id',a,'related_person_id',v_id,'relationship_type',t));
   else raise exception 'ความสัมพันธ์ไม่ถูกต้อง'; end if;
  end if;
 elsif action='link' then
  a:=(payload->>'person_id')::uuid;b:=(payload->>'related_person_id')::uuid;t:=payload->>'relationship_type';
  if coalesce(t,'') not in ('father','mother','spouse','older_sibling') or not public.family_link_allowed(a,b,t) then raise exception 'ไม่มีสิทธิ์เชื่อมความสัมพันธ์นี้'; end if;
  if t in ('father','mother') then
   if exists(select 1 from public.family_relationships where related_person_id=b and relationship_type=t) then raise exception 'มีบิดาหรือมารดาแล้ว กรุณายกเลิกความสัมพันธ์เดิมก่อน'; end if;
   if exists(with recursive descendants(node_id) as (
    select related_person_id from public.family_relationships where person_id=b and relationship_type in ('father','mother')
    union select r.related_person_id from public.family_relationships r join descendants d on r.person_id=d.node_id where r.relationship_type in ('father','mother')
   ) select 1 from descendants where descendants.node_id=a) then raise exception 'ความสัมพันธ์พ่อแม่วนกลับหาบุคคลเดิม'; end if;
  end if;
  insert into public.family_relationships(owner_id,person_id,related_person_id,relationship_type) values(uid,a,b,t) returning family_relationships.id into v_id;
 elsif action='unlink' then
  select person_id,related_person_id,relationship_type into a,b,t from public.family_relationships where family_relationships.id=(payload->>'id')::uuid;
  if not found or not public.family_link_allowed(a,b,t) then raise exception 'ไม่มีสิทธิ์ยกเลิกความสัมพันธ์นี้'; end if;
  delete from public.family_relationships where family_relationships.id=(payload->>'id')::uuid;v_id:=(payload->>'id')::uuid;
 elsif action='delete_person' then
  -- Deletion cascades links, so only Admin can remove a person entirely.
  if not admin then raise exception 'เฉพาะ Admin ลบบุคคลได้'; end if;
  v_id:=(payload->>'id')::uuid; delete from public.family_people where family_people.id=v_id;
 else raise exception 'คำสั่งไม่ถูกต้อง'; end if;
 return jsonb_build_object('id',v_id);
end $$;

-- Raw tables cannot be queried or modified by browser clients, even by guessing columns.
-- RLS stays enabled as defense in depth; RPCs are the only application entry points.
alter table public.family_homes enable row level security;
alter table public.family_admins enable row level security;
alter table public.family_accounts enable row level security;
alter table public.family_join_requests enable row level security;
alter table public.family_people enable row level security;
alter table public.family_relationships enable row level security;
revoke all on public.family_homes,public.family_admins,public.family_accounts,public.family_join_requests,public.family_people,public.family_relationships from public,anon,authenticated;
revoke all on function public.family_is_admin(),public.family_home_edit(uuid),public.family_person_edit(uuid),public.family_link_allowed(uuid,uuid,text),public.family_dashboard(),public.family_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.family_dashboard(),public.family_action(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
