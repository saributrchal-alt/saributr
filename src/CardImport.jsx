import React,{useRef,useState} from 'react'
import {supabase} from './supabase'
import {parseCardImport} from './cardImport'
import {displayName,matchesName} from './personNames'
import PhotoCrop from './PhotoCrop'
export default function CardImport({data,busy,onSave}){
 const [card,setCard]=useState(null),[error,setError]=useState(''),[checking,setChecking]=useState(false),[target,setTarget]=useState(''),[fixed,setFixed]=useState(''),[home,setHome]=useState(''),[useAddress,setUseAddress]=useState(false),[usePhoto,setUsePhoto]=useState(true),[confirmed,setConfirmed]=useState(false),version=useRef(0)
 React.useEffect(()=>()=>{version.current++},[])
 async function select(file){const seq=++version.current;setCard(null);setError('');setConfirmed(false);setUseAddress(false);setUsePhoto(true);setTarget('');setFixed('');if(!file)return;setChecking(true);try{
  if(file.size>200000)throw Error('ไฟล์ใหญ่เกินกำหนด');const value=parseCardImport(await file.text());
  const {data:id,error}=await supabase.rpc('family_card_match',{citizen_id:value.citizen_id});if(error)throw Error(error.code==='PGRST202'?'ต้องรัน SQL นำเข้าบัตรก่อนใช้งาน':error.message);
  if(seq!==version.current)return;setCard(value);setTarget(id||'');setFixed(id||'');setHome(data.people.find(p=>p.id===id)?.home_id||'');
 }catch(e){if(seq===version.current)setError(e.message)}finally{if(seq===version.current)setChecking(false)}}
 const matches=card?data.people.filter(p=>matchesName(p,card.first_name)||matchesName(p,card.last_name)&&card.last_name):[]
 return <div className="form"><p>ในแอปอ่านบัตร กด “บันทึกไฟล์สำหรับนำเข้าสมาชิก” แล้วเลือกไฟล์นั้นที่นี่</p><label>เลือกไฟล์ข้อมูลบัตร<input type="file" accept=".json,application/json" disabled={busy||checking} onChange={e=>select(e.target.files?.[0])}/></label>{checking&&<p>กำลังตรวจเลขบัตรกับสมาชิกเดิม…</p>}{error&&<p className="alert" role="alert">{error}</p>}{card&&<form key={version.current} className="form" onSubmit={e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.currentTarget));onSave({...v,id:target||undefined,home_id:home,citizen_id:card.citizen_id,confirm_distinct:confirmed,...(useAddress?{current_address:card.card_address}:{}),...(!v.birth_date?{birth_date:undefined}:{} )})}}>
 <p>เลขประจำตัวประชาชน: {card.citizen_id}</p>
 <label>นำเข้าให้บุคคลใด<select required value={target||'new'} disabled={!!fixed} onChange={e=>{const id=e.target.value==='new'?'':e.target.value;setTarget(id);setHome(data.people.find(p=>p.id===id)?.home_id||'');setConfirmed(false)}}><option value="new">เพิ่มสมาชิกใหม่</option>{data.people.map(p=><option key={p.id} value={p.id}>{displayName(p)} — {data.homes.find(h=>h.id===p.home_id)?.name}</option>)}</select></label>
 {fixed&&<p>เลขบัตรตรงกับสมาชิกเดิม ระบบจะอัปเดตบุคคลนี้</p>}{!fixed&&matches.length>0&&<p>พบชื่อใกล้เคียง: {matches.slice(0,10).map(displayName).join(' / ')} กรุณาเลือกสมาชิกเดิมหากเป็นคนเดียวกัน</p>}
 <label>บ้านครอบครัว<select required value={home} onChange={e=>setHome(e.target.value)}><option value="">เลือกบ้านครอบครัว</option>{data.homes.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
 {[['name_title','คำนำหน้า'],['first_name','ชื่อ'],['last_name','นามสกุล'],['birth_date','วันเกิด (ค.ศ.)']].map(([k,l])=><label key={k}>{l}<input name={k} type={k==='birth_date'?'date':'text'} required={k==='first_name'} maxLength={200} defaultValue={card[k]}/></label>)}
 {!card.birth_date&&<p>บัตรระบุวันเกิดไม่ครบ กรุณาตรวจสอบก่อนกรอก</p>}
 <label>เพศ<select required name="kinship_gender" defaultValue={card.kinship_gender}><option value="">เลือกเพศ</option><option value="male">ชาย</option><option value="female">หญิง</option></select></label>
 <p>ที่อยู่ตามบัตร: {card.card_address}</p><label className="check-label"><input type="checkbox" checked={useAddress} onChange={e=>setUseAddress(e.target.checked)}/>ยืนยันว่าที่อยู่ตามบัตรเป็นที่อยู่ปัจจุบัน และใช้ที่อยู่นี้</label>
 {card.avatar_image&&<><label className="check-label"><input type="checkbox" checked={usePhoto} onChange={e=>setUsePhoto(e.target.checked)}/>ใช้รูปจากบัตร</label>{usePhoto&&<PhotoCrop initialPhoto={card.avatar_image}/>}</>}
 <label className="check-label"><input required type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>{target?'ตรวจสอบแล้วว่าบัตรตรงกับสมาชิกที่เลือก และยืนยันอัปเดตข้อมูล':'ตรวจสอบรายชื่อแล้ว ยืนยันว่าเป็นสมาชิกใหม่'}</label>
 <p>ข้อมูลเดิมที่ไม่ได้เลือกเปลี่ยนจะคงไว้ เลขบัตรสงวนให้เจ้าตัวและ Admin ที่กดขอดู</p><button className="btn primary" disabled={busy||!confirmed}>{busy?'กำลังบันทึก…':'ยืนยันบันทึกสมาชิก'}</button>
 </form>}</div>
}
