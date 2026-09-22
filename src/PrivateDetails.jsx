import React,{useEffect,useRef,useState} from 'react'
import {supabase} from './supabase'
export default function PrivateDetails({person,own,admin}){
 const [value,setValue]=useState(null),[error,setError]=useState(''),held=useRef(false),request=useRef(0)
 function hide(){held.current=false;request.current++;setValue(null);setError('')}
 useEffect(()=>{const hidden=()=>{if(document.hidden)hide()};window.addEventListener('blur',hide);document.addEventListener('visibilitychange',hidden);return()=>{held.current=false;request.current++;window.removeEventListener('blur',hide);document.removeEventListener('visibilitychange',hidden)}},[])
 async function reveal(){if(held.current)return;held.current=true;const id=++request.current;setError('');const {data,error}=await supabase.rpc('family_private_details',{person_id:person.id});if(!held.current||id!==request.current)return;if(error)setError('ไม่สามารถแสดงข้อมูลได้');else setValue(data)}
 const data=own?person:value
 return <section><h3>ข้อมูลส่วนตัว</h3>{!own&&admin&&<button type="button" className="btn secondary" style={{touchAction:'none',userSelect:'none'}} onContextMenu={e=>e.preventDefault()} onPointerDown={e=>{if(e.button!==0)return;e.currentTarget.setPointerCapture?.(e.pointerId);reveal()}} onPointerUp={hide} onPointerCancel={hide} onPointerLeave={hide} onLostPointerCapture={hide} onBlur={hide} onKeyDown={e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();reveal()}}} onKeyUp={e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();hide()}}}>ขอดู (กดค้าง)</button>}{data?<dl className="facts"><div><dt>วันเกิด (ค.ศ.)</dt><dd>{data.birth_date||'ยังไม่ระบุ'}</dd></div><div><dt>เบอร์ติดต่อ</dt><dd>{data.phone||'ยังไม่ระบุ'}</dd></div></dl>:<p>วันเกิดและเบอร์โทรถูกซ่อน</p>}{error&&<p role="alert">{error}</p>}</section>
}
