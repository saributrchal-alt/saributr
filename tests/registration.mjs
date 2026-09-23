process.on('uncaughtException',e=>{console.error(e.message,e.internalQuery||'',e.where||'');process.exit(1)})
import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const db=new PGlite()
await db.exec(`create role anon;create role authenticated;create schema auth;
create table auth.users(id uuid primary key,email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon;
create table public.family_people(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),full_name text not null check(char_length(trim(full_name)) between 1 and 200),nickname text,birth_date date,death_date date,birthplace text,biography text,created_at timestamptz default now(),updated_at timestamptz default now(),unique(id,owner_id),check(death_date is null or birth_date is null or death_date>=birth_date));
create table public.family_relationships(id uuid primary key default gen_random_uuid(),owner_id uuid references auth.users(id),person_id uuid,related_person_id uuid,relationship_type text check(relationship_type in ('father','mother','spouse','older_sibling')),created_at timestamptz default now(),check(person_id<>related_person_id),unique(person_id,related_person_id,relationship_type),foreign key(person_id,owner_id) references family_people(id,owner_id) on delete cascade,foreign key(related_person_id,owner_id) references family_people(id,owner_id) on delete cascade);
create unique index family_spouse_unique on family_relationships(least(person_id,related_person_id),greatest(person_id,related_person_id)) where relationship_type='spouse';
create unique index family_sibling_unique on family_relationships(least(person_id,related_person_id),greatest(person_id,related_person_id)) where relationship_type='older_sibling';
`)
for(const f of ['20260922_person_names.sql','20260922_kinship_gender.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'))
const u1='10000000-0000-0000-0000-000000000001',u2='10000000-0000-0000-0000-000000000002',admin='10000000-0000-0000-0000-000000000003',u3='10000000-0000-0000-0000-000000000004'
for(const [id,email]of [[u1,'a@test.local'],[u2,'b@test.local'],[admin,'admin@test.local'],[u3,'join@test.local']])await db.query('insert into auth.users values($1,$2)',[id,email])
const p1=(await db.query("insert into family_people(owner_id,full_name,birth_date)values($1,'นาย หนึ่ง บ้านแรก','2000-01-01') returning id",[u1])).rows[0].id
const p2=(await db.query("insert into family_people(owner_id,full_name,birth_date)values($1,'นาง สอง บ้านสอง','1970-01-01') returning id",[u2])).rows[0].id
const migration=await readFile(new URL('../supabase/migrations/20260923_households.sql',import.meta.url),'utf8')
await db.exec(migration)
await db.exec(migration) // repeat-safe and preserves all records
await db.query('insert into family_admins values($1)',[admin])
async function as(id,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+role)}
async function dashboard(){return (await db.query('select family_dashboard() as d')).rows[0].d}
async function act(action,payload){return (await db.query('select family_action($1,$2::jsonb) as r',[action,JSON.stringify(payload)])).rows[0].r}
async function denied(fn){await assert.rejects(fn)}

await db.exec(await readFile(new URL('../supabase/migrations/20260925_registration.sql',import.meta.url),'utf8'))
await db.exec(await readFile(new URL('../supabase/migrations/20260925_registration.sql',import.meta.url),'utf8'))
await db.exec(await readFile(new URL('../supabase/migrations/20260926_fix_registration_list.sql',import.meta.url),'utf8'))
await as(admin);assert.deepEqual((await db.query("select family_registration_admin('list') as d")).rows[0].d,[])
await as(u1);let d=await dashboard();const h1=d.account.home_id
await as(u3);await denied(()=>dashboard());await denied(()=>act('save_home',{name:'bypass'}));await denied(()=>db.query('select family_dashboard_member()'));await denied(()=>db.query("select family_action_member('save_home','{}')"))
assert.equal((await db.query('select family_registration_state() as d')).rows[0].d.approved,false)
const results=(await db.query("select family_registration_search('person','หนึ่ง',null) as d")).rows[0].d
assert.equal(results.length,1);assert.ok(!('birth_date' in results[0]));assert.ok(!('phone' in results[0]))
const request=(await db.query('select family_register($1::jsonb) as id',[JSON.stringify({home_id:h1,person_id:p1,note:'test'})])).rows[0].id
await denied(()=>dashboard());await denied(()=>db.query("select family_registration_admin('approve',$1)",[request]))
await as(admin);const listed=(await db.query("select family_registration_admin('list') as d")).rows[0].d;assert.equal(listed.length,1);assert.equal(listed[0].id,request);assert.equal(listed[0].email,'join@test.local');assert.ok(listed[0].full_name);await db.query("select family_registration_admin('approve',$1)",[request]);assert.deepEqual((await db.query("select family_registration_admin('list') as d")).rows[0].d,[])
await as(u3);d=await dashboard();assert.equal(d.account.home_id,h1);assert.equal(d.account.person_id,p1)
// A new applicant proposes a house and a new person. Neither exists until approval.
await db.exec('reset role');const u4='10000000-0000-0000-0000-000000000005';await db.query('insert into auth.users values($1,$2)',[u4,'new@test.local']);await as(u4)
const newReq=(await db.query('select family_register($1::jsonb) as id',[JSON.stringify({home_draft:{name:'บ้านใหม่',province:'สกลนคร',district:'วานรนิวาส',subdistrict:'ธาตุ'},person_draft:{first_name:'ใหม่',last_name:'ทดสอบ',kinship_gender:'male'},confirm_new_person:true})])).rows[0].id
await as(admin);assert.equal((await dashboard()).homes.length,2);await db.query("select family_registration_admin('reject',$1,'กรุณาตรวจสอบ')",[newReq]);await as(u4);assert.equal((await db.query('select family_registration_state() as d')).rows[0].d.request.status,'rejected')
const retry=(await db.query('select family_register($1::jsonb) as id',[JSON.stringify({home_draft:{name:'บ้านใหม่',province:'สกลนคร',district:'วานรนิวาส',subdistrict:'ธาตุ'},person_draft:{first_name:'ใหม่',last_name:'ทดสอบ',kinship_gender:'male'},confirm_new_person:true})])).rows[0].id
await denied(()=>db.query('select * from family_registrations'))
await as(admin);await db.query("select family_registration_admin('approve',$1)",[retry]);await as(u4);d=await dashboard();assert.equal(d.homes.length,3);assert.ok(d.account.person_id);assert.equal(d.homes.find(h=>h.id===d.account.home_id).name,'บ้านใหม่')
await as(null,'anon');await denied(()=>db.query('select family_registration_state()'));await denied(()=>db.query("select family_registration_search('person','หนึ่ง',null)"))
await db.exec('reset role');
await db.exec('create table auth.identities(user_id uuid,provider text,identity_data jsonb);revoke all on auth.identities from public,anon,authenticated;')
await db.query("insert into auth.identities values($1,'custom:line-oauth',$2)",[u4,JSON.stringify({picture:'https://example.com/line.jpg',email:'private@example.com',sub:'private-line-id'})])
const avatarMigration=await readFile(new URL('../supabase/migrations/20260927_member_avatars.sql',import.meta.url),'utf8')
await db.exec(avatarMigration);await db.exec(avatarMigration)
await as(u1);const pictured=(await dashboard()).people.find(p=>p.id===d.account.person_id)
assert.equal(pictured.avatar_url,'https://example.com/line.jpg');assert.ok(!('email' in pictured));assert.ok(!('sub' in pictured));assert.ok(!('birth_date' in pictured))
await denied(()=>db.query('select * from auth.identities'))
await as(null,'anon');await denied(()=>dashboard())
await db.exec('reset role');
await db.query("update family_people set birth_date='1990-02-03',phone='0812345678' where id=$1",[d.account.person_id])
await db.exec(await readFile(new URL('../supabase/migrations/20260928_private_contact.sql',import.meta.url),'utf8'))
await as(u4);assert.equal((await dashboard()).people.find(p=>p.id===d.account.person_id).phone,'0812345678')
await as(admin);assert.ok(!('phone' in (await dashboard()).people.find(p=>p.id===d.account.person_id)))
assert.equal((await db.query('select family_private_details($1) as d',[d.account.person_id])).rows[0].d.phone,'0812345678')
await db.exec('reset role');await db.query('update family_accounts set home_id=$1 where user_id=$2',[d.account.home_id,u1]);await as(u1)
assert.ok(!('birth_date' in (await dashboard()).people.find(p=>p.id===d.account.person_id)))
await denied(()=>db.query('select family_private_details($1)',[d.account.person_id]))
const edited=(await dashboard()).people.find(p=>p.id===d.account.person_id)
await act('save_person',{...edited,birth_date:'2001-01-01',phone:'changed'})
await as(u4);assert.equal((await dashboard()).people.find(p=>p.id===d.account.person_id).phone,'0812345678')
await db.exec('reset role');
const occupationMigration=await readFile(new URL('../supabase/migrations/20260929_occupation.sql',import.meta.url),'utf8')
await db.exec(occupationMigration);await db.exec(occupationMigration)
await as(u4);const self=(await dashboard()).people.find(p=>p.id===d.account.person_id)
await act('save_person',{...self,occupation:'  ครู  '})
await as(u2);assert.equal((await dashboard()).people.find(p=>p.id===self.id).occupation,'ครู')
await denied(()=>act('save_person',{...self,occupation:'unauthorized'}))
await as(u4);assert.equal((await dashboard()).people.find(p=>p.id===self.id).phone,'0812345678')
await act('save_person',{...self,occupation:''});assert.equal((await dashboard()).people.find(p=>p.id===self.id).occupation,null)
await db.exec('reset role');await db.exec(await readFile(new URL('../supabase/migrations/20260930_kinship_age_order.sql',import.meta.url),'utf8'))
await as(u2);const rankedPerson=(await dashboard()).people.find(p=>p.id===self.id)
assert.ok(Number.isFinite(rankedPerson.age_order));assert.ok(!('birth_date' in rankedPerson));assert.ok(!('phone' in rankedPerson))
await db.exec('reset role');const marriageMigration=await readFile(new URL('../supabase/migrations/20261001_marriage_history.sql',import.meta.url),'utf8');await db.exec(marriageMigration);await db.exec(marriageMigration)
await as(admin)
const spouseLink=await act('link',{person_id:p2,related_person_id:self.id,relationship_type:'spouse'})
await act('marriage',{id:spouseLink.id,marriage_status:'divorced',married_on:'2000-01-01',ended_on:'2010-01-01'})
assert.equal((await dashboard()).relations.find(r=>r.id===spouseLink.id).marriage_status,'divorced')
await denied(()=>act('marriage',{id:spouseLink.id,marriage_status:'married',married_on:'2010-01-01',ended_on:'2000-01-01'}))
const child=await act('save_person',{home_id:self.home_id,first_name:'ลูกทดสอบ',last_name:'',kinship_gender:'male',confirm_distinct:true,link_anchor:p2,link_role:'child',parent_role:'father',other_parent_id:self.id})
const parents=(await dashboard()).relations.filter(r=>r.related_person_id===child.id)
assert.ok(parents.some(r=>r.person_id===p2&&r.relationship_type==='father'));assert.ok(parents.some(r=>r.person_id===self.id&&r.relationship_type==='mother'))
await act('marriage',{id:spouseLink.id,marriage_status:'widowed'});assert.equal((await dashboard()).relations.filter(r=>r.related_person_id===child.id).length,parents.length)
const before=(await dashboard()).people.length
await denied(()=>act('save_person',{home_id:self.home_id,first_name:'ต้องย้อนกลับ',kinship_gender:'male',confirm_distinct:true,link_anchor:p2,link_role:'child',parent_role:'father',other_parent_id:'90000000-0000-0000-0000-000000000099'}))
assert.equal((await dashboard()).people.length,before)
await as(u2);await denied(()=>act('marriage',{id:spouseLink.id,marriage_status:'divorced'}))
await db.exec('reset role');const photoMigration=await readFile(new URL('../supabase/migrations/20261002_profile_photo.sql',import.meta.url),'utf8');await db.exec(photoMigration);await db.exec(photoMigration)
await as(u4);const photoPerson=(await dashboard()).people.find(p=>p.id===self.id)
await act('save_person',{...photoPerson,avatar_image:'data:image/jpeg;base64,/9j/AA=='})
assert.equal((await dashboard()).people.find(p=>p.id===self.id).avatar_url,'data:image/jpeg;base64,/9j/AA==')
await denied(()=>act('save_person',{...photoPerson,avatar_image:'data:text/html;base64,AAAA'}))
await as(u2);await denied(()=>act('save_person',{...photoPerson,avatar_image:'data:image/jpeg;base64,AAAA'}))
console.log('PASS photo persistence, format validation and edit permissions')
console.log('PASS marriage history, parent pairs, status changes preserve children, atomic rollback and permissions')
console.log('PASS server age order without exposing private dates')
console.log('PASS occupation save, trim, clear and access control')
console.log('PASS private contact: owner access, admin on-demand, same-house denied, hidden fields preserved')
await db.exec('reset role');await db.query('delete from family_accounts where user_id=$1',[u4]);await as(u4);await denied(()=>dashboard())
console.log('PASS avatars: linked LINE photo, cross-house privacy, anonymous and unapproved denied, repeat-safe migration')
console.log('PASS registration: gating, RPC bypass denied, minimal search, admin approval, drafts, rejection and resubmission, existing members, anonymous denied');await db.close()
