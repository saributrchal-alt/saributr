import React, { useEffect, useState } from 'react'
import { supabase } from './supabase'
import Auth from './Auth'

const labels = {father:'เป็นพ่อของ',mother:'เป็นแม่ของ',spouse:'เป็นคู่สมรสของ',older_sibling:'เป็นพี่ของ',younger_sibling:'เป็นน้องของ'}
const fields = [['full_name','ชื่อ–นามสกุล','text'],['nickname','ชื่อเล่น','text'],['birth_date','วันเกิด (ค.ศ.)','date'],['death_date','วันที่เสียชีวิต (ถ้ามี / ค.ศ.)','date'],['birthplace','บ้านเกิด','text']]
function errorText(e) {
  if(e.code==='23514'&&e.message?.includes('relationship_type')) return 'กรุณารัน SQL เพิ่มความสัมพันธ์พี่น้องใน Supabase ก่อน แล้วลองบันทึกอีกครั้ง'
  if(e.code==='23505') return 'มีความสัมพันธ์นี้แล้ว'
  if(e.message?.includes('Invalid login')) return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
  if(e.message?.includes('Email not confirmed')) return 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ'
  return e.message || 'เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง'
}
function Workspace({user}){
  const [people,setPeople]=useState([]),[relations,setRelations]=useState([]),[selected,setSelected]=useState(''),[query,setQuery]=useState('')
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[modal,setModal]=useState(null)
  async function load(){
    setLoading(true)
    try{
      const [p,r]=await Promise.all([supabase.from('family_people').select('*').order('created_at'),supabase.from('family_relationships').select('*').order('created_at')])
      if(p.error)throw p.error;if(r.error)throw r.error
      setPeople(p.data);setRelations(r.data);setSelected(old=>p.data.some(x=>x.id===old)?old:p.data[0]?.id||'')
    }finally{setLoading(false)}
  }
  useEffect(()=>{load().catch(e=>setError(errorText(e)))},[])
  async function mutate(action,success){
    if(busy)return;setBusy(true);setError('');setNotice('')
    try{
      const result=await action();if(result.error)throw result.error
      if(!result.data?.length)throw new Error('ไม่พบข้อมูลที่เปลี่ยนแปลง กรุณาโหลดใหม่')
      setModal(null);setNotice(success)
      try{await load()}catch(e){setError('บันทึกแล้ว แต่โหลดข้อมูลล่าสุดไม่สำเร็จ: '+errorText(e))}
    }catch(e){setError(errorText(e))}finally{setBusy(false)}
  }
  const person=people.find(p=>p.id===selected),name=id=>people.find(p=>p.id===id)?.full_name||'ไม่พบสมาชิก'
  const connected=relations.filter(r=>r.person_id===selected||r.related_person_id===selected)
  const groups=[
    ['พ่อและแม่',connected.filter(r=>r.related_person_id===selected&&['father','mother'].includes(r.relationship_type)).map(r=>[r.person_id,r.relationship_type==='father'?'พ่อ':'แม่'])],
    ['คู่สมรส',connected.filter(r=>r.relationship_type==='spouse').map(r=>[r.person_id===selected?r.related_person_id:r.person_id,'คู่สมรส'])],
    ['พี่และน้อง',connected.filter(r=>r.relationship_type==='older_sibling').map(r=>[r.person_id===selected?r.related_person_id:r.person_id,r.person_id===selected?'น้อง':'พี่'])],
    ['ลูก',connected.filter(r=>r.person_id===selected&&['father','mother'].includes(r.relationship_type)).map(r=>[r.related_person_id,'ลูก'])]
  ]
  function savePerson(e){
    e.preventDefault();const f=new FormData(e.currentTarget)
    const values=Object.fromEntries([...fields.map(x=>x[0]),'biography'].map(k=>[k,f.get(k)?.trim()||null]))
    if(!values.full_name){setError('กรุณาระบุชื่อ');return}
    if(values.birth_date&&values.death_date&&values.death_date<values.birth_date){setError('วันที่เสียชีวิตต้องไม่ก่อนวันเกิด');return}
    mutate(()=>modal.person?supabase.from('family_people').update(values).eq('id',modal.person.id).select('id'):supabase.from('family_people').insert({...values,owner_id:user.id}).select('id'),'บันทึกข้อมูลแล้ว')
  }
  function saveRelation(e){
    e.preventDefault();const f=new FormData(e.currentTarget),a=f.get('person_id'),b=f.get('related_person_id'),type=f.get('relationship_type')
    if(a===b){setError('กรุณาเลือกคนละบุคคล');return}
    // Reject parent cycles in the currently loaded graph.
    const visited=new Set(),queue=[b]
    if(['father','mother'].includes(type))while(queue.length){const id=queue.pop();if(id===a){setError('ความสัมพันธ์พ่อแม่จะวนกลับหาบุคคลเดิม กรุณาตรวจสอบ');return}if(visited.has(id))continue;visited.add(id);relations.filter(r=>r.person_id===id&&['father','mother'].includes(r.relationship_type)).forEach(r=>queue.push(r.related_person_id))}
    const from=type==='younger_sibling'?b:a,to=type==='younger_sibling'?a:b,storedType=type==='younger_sibling'?'older_sibling':type
    if(storedType==='older_sibling'&&relations.some(r=>r.relationship_type==='older_sibling'&&((r.person_id===from&&r.related_person_id===to)||(r.person_id===to&&r.related_person_id===from)))){setError('คู่นี้เชื่อมเป็นพี่น้องแล้ว หากต้องการสลับลำดับ ให้ยกเลิกความสัมพันธ์เดิมก่อน');return}
    mutate(()=>supabase.from('family_relationships').insert({owner_id:user.id,person_id:from,related_person_id:to,relationship_type:storedType}).select('id'),'บันทึกความสัมพันธ์แล้ว')
  }
  return <div className="shell"><header className="topbar"><a className="brand" href="#top"><b>ส</b><span><strong>สายใยครอบครัว</strong><small>ตระกูลสาริบุตร</small></span></a><span className="account-email">{user.email}</span><button className="btn secondary" disabled={busy} onClick={async()=>{const {error}=await supabase.auth.signOut();if(error)setError(errorText(error))}}>ออกจากระบบ</button></header>
    <main id="top" className="workspace"><div className="heading"><div><p className="eyebrow">ครอบครัวของฉัน</p><h1>ตระกูลสาริบุตร</h1><p>{people.length} คน · ข้อมูลส่วนตัวของบัญชีนี้</p></div><button className="btn primary" disabled={busy||loading} onClick={()=>{setError('');setModal({type:'person'})}}>+ เพิ่มบุคคล</button></div>
    {error&&<p className="alert" role="alert">{error}</p>}{notice&&<p className="success" role="status">{notice}</p>}
    <div className="toolbar"><input aria-label="ค้นหาสมาชิก" placeholder="ค้นหาชื่อหรือชื่อเล่น" value={query} onChange={e=>setQuery(e.target.value)}/><button className="btn secondary" disabled={loading||busy} onClick={()=>{setError('');load().catch(e=>setError(errorText(e)))}}>โหลดใหม่</button></div>
    {loading?<p role="status">กำลังโหลดข้อมูล…</p>:<div className="family-grid"><section className="members-panel"><h2>สมาชิก</h2>{!people.length&&<p>เริ่มด้วยการเพิ่มตัวเอง แล้วเพิ่มพ่อ แม่ และญาติ</p>}{people.filter(p=>(p.full_name+' '+(p.nickname||'')).includes(query.trim())).map(p=><button key={p.id} className={'member-card '+(selected===p.id?'selected':'')} onClick={()=>setSelected(p.id)}><span className="avatar green">{p.full_name.slice(0,1)}</span><span><strong>{p.full_name}</strong><small>{p.nickname||p.birthplace||'ดูรายละเอียด'}</small></span></button>)}</section>
    {person&&<section className="person-panel"><div className="heading"><h2>{person.full_name}</h2><button className="btn secondary" disabled={busy} onClick={()=>{setError('');setModal({type:'person',person})}}>แก้ไข</button></div><dl className="facts">{[...fields.slice(1).map(([key,label])=>[label,person[key]]),['เรื่องราว',person.biography]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v||'ยังไม่ระบุ'}</dd></div>)}</dl>
    <div className="heading"><h2>เครือญาติของบุคคลนี้</h2><button className="btn secondary" disabled={people.length<2||busy} onClick={()=>{setError('');setModal({type:'relation'})}}>+ เชื่อมญาติ</button></div><div className="relation-groups">{groups.map(([label,items])=><section key={label}><h3>{label}</h3>{items.length?items.map(([id,role])=><button className="relative" key={id+role} onClick={()=>setSelected(id)}>{name(id)} <small>({role})</small></button>):<p>ยังไม่ได้เชื่อมข้อมูล</p>}</section>)}</div>
    <details><summary>จัดการความสัมพันธ์</summary>{connected.map(r=><div className="relation-line" key={r.id}><span>{name(r.person_id)} {labels[r.relationship_type]} {name(r.related_person_id)}</span><button className="btn secondary" disabled={busy} onClick={()=>{if(window.confirm('ยกเลิกความสัมพันธ์นี้? ข้อมูลบุคคลจะยังอยู่'))mutate(()=>supabase.from('family_relationships').delete().eq('id',r.id).select('id'),'ยกเลิกความสัมพันธ์แล้ว')}}>ยกเลิก</button></div>)}</details><button className="btn danger" disabled={busy} onClick={()=>{if(window.confirm('ลบ '+person.full_name+' และความสัมพันธ์ของบุคคลนี้?'))mutate(()=>supabase.from('family_people').delete().eq('id',person.id).select('id'),'ลบข้อมูลแล้ว')}}>ลบบุคคลนี้</button></section>}</div>}</main>
    {modal&&<div className="backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header><h2 id="dialog-title">{modal.type==='person'?(modal.person?'แก้ไขข้อมูล':'เพิ่มบุคคล'):'เชื่อมความสัมพันธ์'}</h2><button aria-label="ปิด" disabled={busy} onClick={()=>setModal(null)}>×</button></header>{error&&<p className="alert" role="alert">{error}</p>}{modal.type==='person'?<form className="form" onSubmit={savePerson}>{fields.map(([key,label,type])=><label key={key}>{label}<input name={key} type={type} defaultValue={modal.person?.[key]||''} required={key==='full_name'} maxLength={key==='full_name'?200:undefined}/></label>)}<label>ประวัติและเรื่องราว<textarea name="biography" rows={4} defaultValue={modal.person?.biography||''}/></label><button className="btn primary" disabled={busy}>{busy?'กำลังบันทึก…':'บันทึกข้อมูล'}</button></form>:<form className="form" onSubmit={saveRelation}><label>บุคคล<select name="person_id" defaultValue={selected}>{people.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label><label>ความสัมพันธ์<select name="relationship_type">{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>บุคคลอีกคน<select name="related_person_id" defaultValue={people.find(p=>p.id!==selected)?.id}>{people.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label><p>ตัวอย่าง: เลือกชื่อพี่ → เป็นพี่ของ → เลือกชื่อน้อง</p><button className="btn primary" disabled={busy}>{busy?'กำลังบันทึก…':'บันทึกความสัมพันธ์'}</button></form>}</section></div>}
  </div>
}
export default function App(){
  const [session,setSession]=useState(undefined),[error,setError]=useState('')
  useEffect(()=>{let active=true;const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>{if(active)setSession(s)});supabase.auth.getSession().then(({data,error})=>{if(active){if(error)setError(errorText(error));setSession(data.session)}}).catch(e=>{if(active){setError(errorText(e));setSession(null)}});return()=>{active=false;subscription.unsubscribe()}},[])
  if(session===undefined)return <main>กำลังเชื่อมต่อ…</main>
  if(error)return <main><p role="alert">{error}</p><button onClick={()=>window.location.reload()}>ลองใหม่</button></main>
  return session?<Workspace key={session.user.id} user={session.user}/>:<Auth/>
}
