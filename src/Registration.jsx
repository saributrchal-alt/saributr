import React,{useEffect,useState} from 'react'
import {supabase} from './supabase'
import {HomeForm} from './Dashboard'
import {titleGroups} from './nameTitle'
export function RegistrationSearch({kind,homeId,onSelect,label}){
 const [q,setQ]=useState(''),[rows,setRows]=useState([]),[error,setError]=useState('')
 useEffect(()=>{let active=true;setRows([]);setError('');const timer=setTimeout(async()=>{if(q.trim().length<2)return;const {data,error}=await supabase.rpc('family_registration_search',{kind,query:q,selected_home:homeId||null});if(active){if(error)setError(error.message);else setRows(data||[])}},300);return()=>{active=false;clearTimeout(timer)}},[q,kind,homeId])
 return <div className="people-picker"><label>{label}<input value={q} onChange={e=>setQ(e.target.value)} placeholder="พิมพ์อย่างน้อย 2 ตัวอักษร"/></label>{rows.map(r=><button className="relative" type="button" key={r.id} onClick={()=>{onSelect(r);setQ('')}}>{r.name||r.full_name}{r.home_name&&<small>{r.home_name}</small>}</button>)}{error&&<p role="alert">{error}</p>}</div>
}
export function PasswordForm({onDone}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 return <form className="form" onSubmit={async e=>{e.preventDefault();if(busy)return;const f=new FormData(e.currentTarget);if(f.get('password')!==f.get('confirm')){setError('รหัสผ่านไม่ตรงกัน');return}setBusy(true);setError('');const {error}=await supabase.auth.updateUser({password:f.get('password')});setBusy(false);if(error)setError(error.message);else onDone?.()}}><label>รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)<input name="password" type="password" minLength={8} required autoComplete="new-password"/></label><label>ยืนยันรหัสผ่าน<input name="confirm" type="password" minLength={8} required autoComplete="new-password"/></label>{error&&<p className="alert">{error}</p>}<button className="btn primary" disabled={busy}>บันทึกรหัสผ่าน</button></form>
}
export default function RegistrationGate({user,children}){
 const [state,setState]=useState(null),[error,setError]=useState(''),[home,setHome]=useState(null),[draft,setDraft]=useState(null),[newHome,setNewHome]=useState(false),[person,setPerson]=useState(null),[newPerson,setNewPerson]=useState(false),[busy,setBusy]=useState(false),[passwordSet,setPasswordSet]=useState(false)
 async function load(){const {data,error}=await supabase.rpc('family_registration_state');if(error)throw error;setState(data)}
 useEffect(()=>{load().catch(e=>setError(e.code==='PGRST202'?'ระบบสมัครกำลังอัปเดต กรุณาให้ผู้ดูแลรัน SQL ระบบสมัครสมาชิกก่อน':e.message))},[])
 if(state?.approved)return children
 const request=state?.request
 return <main className="auth-page"><section className="auth-card registration-card"><h1>สมัครสมาชิกสายใยครอบครัว</h1><p>ยืนยันอีเมลแล้ว: {user.email}</p>{error&&<p className="alert" role="alert">{error}</p>}
 {!state?<button className="btn secondary" onClick={()=>load().catch(e=>setError(e.message))}>ตรวจสอบอีกครั้ง</button>:request?.status==='pending'?<><h2>รอ Admin อนุมัติ</h2><p>ส่งคำขอแล้ว เมื่อได้รับอนุมัติจะเข้าสู่ Dashboard ที่บ้านครอบครัวของท่าน</p><button className="btn primary" onClick={()=>load().catch(e=>setError(e.message))}>ตรวจสอบผลอนุมัติ</button></>:<>
 {request?.status==='rejected'&&<p className="alert">คำขอยังไม่ผ่าน: {request.review_note||'กรุณาตรวจสอบข้อมูลและส่งใหม่'}</p>}
 <RegistrationSearch kind="home" label="บ้านครอบครัวที่มีอยู่แล้ว" onSelect={h=>{setHome(h);setDraft(null);setNewHome(false);setPerson(null)}}/>{home&&<p className="success">บ้านที่เลือก: {home.name}</p>}
 <button className="btn secondary" onClick={()=>{setNewHome(true);setHome(null);setPerson(null);setDraft(null)}}>ไม่พบบ้าน · เสนอสร้างบ้านครอบครัวใหม่</button>
 {newHome&&!draft&&<><p>ข้อมูลนี้เป็นข้อเสนอ ยังไม่สร้างบ้านจนกว่า Admin อนุมัติ ผู้สมัครจะเป็นผู้ประสานงานเริ่มต้น</p><HomeForm people={[]} busy={false} onSave={v=>setDraft(v)}/></>}
 {draft&&<p className="success">บ้านใหม่: {draft.name} <button type="button" onClick={()=>setDraft(null)}>แก้ไข</button></p>}
 {(home||draft)&&<><RegistrationSearch key={home?.id||'new'} kind="person" homeId={home?.id} label="ข้าพเจ้าคือ" onSelect={p=>{setPerson(p);setNewPerson(false)}}/>{person&&<p className="success">{person.full_name}</p>}<button className="btn secondary" onClick={()=>{setPerson(null);setNewPerson(true)}}>ไม่พบชื่อตนเอง · เพิ่มข้อมูลตนเอง</button>
 <form className="form" onSubmit={async e=>{e.preventDefault();if(busy)return;const f=new FormData(e.currentTarget);setBusy(true);setError('');const {error}=await supabase.rpc('family_register',{payload:{home_id:home?.id,home_draft:draft,person_id:person?.id,person_draft:newPerson?{name_title:f.get('name_title'),first_name:f.get('first_name'),last_name:f.get('last_name'),kinship_gender:f.get('kinship_gender')}:null,confirm_new_person:f.get('confirm_new_person')==='on',note:f.get('note')}});if(error)setError(error.message);else await load().catch(e=>setError(e.message));setBusy(false)}}>
 {newPerson&&<><label>คำนำหน้า<select name="name_title"><option value="">ไม่ระบุ</option>{titleGroups.map(([g,ts])=><optgroup key={g} label={g}>{ts.map(t=><option key={t}>{t}</option>)}</optgroup>)}</select></label><label>ชื่อ<input name="first_name" maxLength={200} required/></label><label>นามสกุล<input name="last_name" maxLength={200}/></label><label>เพศ<select name="kinship_gender" required><option value="">เลือกเพศ</option><option value="male">ชาย</option><option value="female">หญิง</option></select></label><label><input type="checkbox" name="confirm_new_person" required/>ค้นหาแล้ว ไม่พบชื่อของตนเองในระบบ</label></>}
 <label>ข้อความถึง Admin<textarea name="note" maxLength={1000}/></label><button className="btn primary" disabled={busy||(!person&&!newPerson)}>{busy?'กำลังส่ง…':'สมัครและส่งให้ Admin อนุมัติ'}</button></form></>}
 </>}
 <hr/><h2>ตั้งรหัสผ่านสำหรับครั้งถัดไป</h2>{passwordSet?<p className="success">ตั้งรหัสผ่านแล้ว</p>:<PasswordForm onDone={()=>setPasswordSet(true)}/>}
 <p>LINE OA: อยู่ระหว่างเตรียมการ ยังไม่เปิดเชื่อมต่อ</p><button className="btn secondary" onClick={async()=>{const {error}=await supabase.auth.signOut();if(error)setError(error.message)}}>ออกจากระบบ</button>
 </section></main>
}
export function RegistrationAdmin({onChanged}){
 const [rows,setRows]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notes,setNotes]=useState({})
 async function load(){const {data,error}=await supabase.rpc('family_registration_admin',{action:'list'});if(error)setError(error.message);else setRows(data||[])}
 useEffect(()=>{load()},[])
 async function review(r,action){if(busy)return;if(action==='approve'&&!confirm('ตรวจสอบตัวตน บ้าน และข้อมูลแล้ว ยืนยันอนุมัติสมาชิกนี้?'))return;setBusy(true);setError('');const {error}=await supabase.rpc('family_registration_admin',{action,request_id:r.id,review_note:notes[r.id]||''});if(error)setError(error.message);else{await load();await onChanged?.()}setBusy(false)}
 return <section className="house-info"><div className="heading"><h2>Admin · อนุมัติสมาชิกใหม่</h2><button className="btn secondary" onClick={load}>โหลดคำขอใหม่</button></div>{error&&<p className="alert">{error}</p>}{!rows.length&&<p>ไม่มีคำขอสมัครใหม่รออนุมัติ</p>}{rows.map(r=><div key={r.id} className="registration-review"><h3>{r.email}</h3><p>บ้าน: {r.home_name||r.home_draft?.name} {r.home_draft?'(เสนอสร้างใหม่)':''}</p><p>ข้าพเจ้าคือ: {r.full_name||[r.person_draft?.name_title,r.person_draft?.first_name,r.person_draft?.last_name].filter(Boolean).join(' ')}</p>{r.home_draft&&<p>{['address_line','subdistrict','district','province','postal_code','phone','exact_latitude','exact_longitude'].map(k=>r.home_draft[k]).filter(Boolean).join(' · ')}</p>}<p>{r.note}</p><label>เหตุผล / ข้อความถึงผู้สมัคร<input value={notes[r.id]||''} onChange={e=>setNotes({...notes,[r.id]:e.target.value})}/></label><div className="actions"><button className="btn primary" disabled={busy} onClick={()=>review(r,'approve')}>อนุมัติ</button><button className="btn danger" disabled={busy} onClick={()=>review(r,'reject')}>ไม่อนุมัติ</button></div></div>)}</section>
}
