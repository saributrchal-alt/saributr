-- เปลี่ยนอีเมลด้านล่างเป็นอีเมลที่ใช้เข้าสู่ระบบ saributr.com จริง
-- รันด้วย SQL Editor เท่านั้น ไม่วาง service-role key ในเว็บไซต์
-- คำสั่งนี้จะไม่สร้าง Admin หากหาอีเมลไม่พบ
DO $$
declare admin_email text := 'ใส่อีเมลที่ใช้เข้าสู่ระบบที่นี่'; target_id uuid;
begin
 select id into target_id from auth.users where lower(email)=lower(trim(admin_email));
 if target_id is null then raise exception 'ไม่พบอีเมลนี้ในระบบ กรุณาแก้อีเมลและเข้าสู่เว็บด้วย OTP ก่อน'; end if;
 insert into public.family_admins(user_id) values(target_id) on conflict(user_id) do nothing;
end $$;
