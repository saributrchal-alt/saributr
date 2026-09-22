begin;
create or replace function public.family_registration_admin(action text,request_id uuid default null,review_note text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.family_registrations%rowtype; h uuid;p uuid;hd jsonb;pd jsonb;
begin
 if auth.uid() is null or not public.family_is_admin() then raise exception 'เฉพาะ Admin'; end if;
 if action='list' then return coalesce((select jsonb_agg(to_jsonb(x)) from (select registration.*,applicant.email,house.name as home_name,person.full_name from public.family_registrations registration join auth.users applicant on applicant.id=registration.user_id left join public.family_homes house on house.id=registration.home_id left join public.family_people person on person.id=registration.person_id where registration.status='pending' order by registration.created_at)x),'[]'); end if;
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
revoke all on function public.family_registration_admin(text,uuid,text) from public,anon,authenticated;
grant execute on function public.family_registration_admin(text,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
