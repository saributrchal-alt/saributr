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

await as(admin);await db.exec('reset role');
await db.exec(await readFile(new URL('../supabase/migrations/20260924_delete_home.sql',import.meta.url),'utf8'))
await as(u1);await denied(()=>db.query('select family_delete_home($1,$2)',[h1,h2]))
await as(admin);await denied(()=>db.query('select family_delete_home($1)',[h1]));await denied(()=>db.query('select family_delete_home($1,$2)',[h1,h1]))
await db.query('select family_delete_home($1,$2)',[h1,h2]);d=await dashboard();assert.equal(d.homes.length,1);assert.equal(d.people.length,2);assert.equal(d.people.find(p=>p.id===p1).home_id,h2)
await as(u1);assert.equal((await dashboard()).account.home_id,h2)
await as(admin);await act('save_home',{name:'บ้านแอดมิน'});const empty=await act('save_home',{name:'บ้านว่าง'});await db.query('select family_delete_home($1)',[empty.id]);assert.equal((await dashboard()).homes.length,2)
console.log('PASS admin-only delete, occupied guard, transfer and empty delete');await db.close()
