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
await as(u1);let d=await dashboard();assert.equal(d.people.length,2);assert.ok(d.people.find(p=>p.id===p1).birth_date);assert.ok(!('birth_date' in d.people.find(p=>p.id===p2)));const h1=d.account.home_id,h2=d.people.find(p=>p.id===p2).home_id
await denied(()=>db.query('select birth_date from family_people'))
await denied(()=>db.query('insert into family_admins values($1)',[u1]))
await denied(()=>db.query('select family_link_allowed($1,$2,$3)',[p1,p2,'spouse']))
await denied(()=>act('link',{person_id:p2,related_person_id:p1,relationship_type:'mother'}))
await act('request_join',{home_id:h1,person_id:p1,note:'claim self'})
await as(admin);d=await dashboard();await act('review_request',{id:d.requests[0].id,decision:'approved'})
await as(u1);await act('link',{person_id:p2,related_person_id:p1,relationship_type:'mother'})
await denied(()=>act('link',{person_id:p1,related_person_id:p2,relationship_type:'father'}))
await denied(()=>act('link',{person_id:p1,related_person_id:p2,relationship_type:'older_sibling'}))
await denied(()=>act('save_person',{id:p2,home_id:h2,first_name:'hacked',kinship_gender:'female'}))
await denied(()=>act('save_person',{id:p1,home_id:h2,first_name:'moved',kinship_gender:'male'}))
await act('save_home',{id:h1,name:'บ้านหนึ่ง',phone:'private-phone',address_line:'secret address',exact_latitude:13.123456,exact_longitude:100.123456,coordinator_id:p1})
await as(u2);d=await dashboard();const publicHome=d.homes.find(h=>h.id===h1);assert.equal(publicHome.latitude,13.12);assert.ok(!('phone'in publicHome));assert.ok(!('exact_latitude'in publicHome));assert.ok(!('address_line'in publicHome));
await denied(()=>act('save_home',{id:h1,name:'hacked'}))
await as(u1);const personPayload={home_id:h1,first_name:'ใหม่',last_name:'ทดสอบ',kinship_gender:'female',birth_first_name:'เดิม',birth_last_name:'ต้น',phone:'123',current_address:'private-current'}
const child=await act('save_person',{...personPayload,link_anchor:p1,link_role:'child',parent_role:'father'})
d=await dashboard();assert.ok(d.relations.some(r=>r.person_id===p1&&r.related_person_id===child.id))
await denied(()=>act('save_person',personPayload))
const count=d.people.length
await denied(()=>act('save_person',{...personPayload,first_name:'rollback',link_anchor:p2,link_role:'child',parent_role:'mother'}))
assert.equal((await dashboard()).people.length,count)
await denied(()=>act('link',{person_id:child.id,related_person_id:p1,relationship_type:'mother'}))
await as(u2);const stranger=(await dashboard()).people.find(p=>p.id===child.id);assert.equal(stranger.birth_first_name,'เดิม');for(const k of ['phone','current_address','biography','birth_date'])assert.ok(!(k in stranger))
await as(u3);await act('request_join',{home_id:h1,person_id:child.id});await denied(()=>act('save_person',{...personPayload,id:child.id}));await denied(async()=>act('review_request',{id:(await dashboard()).requests[0].id,decision:'approved'}))
await as(admin);d=await dashboard();await act('review_request',{id:d.requests.find(r=>r.user_id===u3).id,decision:'approved'})
await as(u3);assert.ok((await dashboard()).people.find(p=>p.id===p1).can_edit);await act('save_person',{...personPayload,id:child.id,nickname:'updated'});await denied(()=>act('delete_person',{id:child.id}))
await as(admin);
await denied(()=>act('save_home',{id:h1,name:'wrong coordinator',coordinator_id:p2}));
const h3=(await act('save_home',{name:'บ้านสาม'})).id;
assert.ok((await dashboard()).homes.some(h=>h.id===h3));
await act('save_person',{...personPayload,id:child.id,home_id:h3});
await as(u3);assert.equal((await dashboard()).account.home_id,h3);
await denied(()=>act('save_person',{...personPayload,id:p1,home_id:h1}));
await as(null,'anon');await denied(dashboard);await denied(()=>db.query('select * from family_people'))
await as(admin);assert.equal((await dashboard()).people.length,count);console.log('PASS: migration twice; privacy projection; raw table denial; admin privilege protection; self cross-home links; denied other links; cycle checks; duplicate checks; atomic create/link rollback; membership approval; same-house edits; anonymous denial')
await db.close()
