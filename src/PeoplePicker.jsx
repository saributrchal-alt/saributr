import React,{useState} from 'react'
import {displayName,matchesName} from './personNames'
export default function PeoplePicker({people,homes,onSelect,exclude=[],label='ค้นหาบุคคลที่มีอยู่',value,onChange}) {
 const [text,setText]=useState('')
 const q=value??text
 const results=q.trim()?people.filter(p=>!exclude.includes(p.id)&&matchesName(p,q)):[]
 return <div className="people-picker"><label>{label}<input value={q} onChange={e=>{setText(e.target.value);onChange?.(e.target.value)}} placeholder="ชื่อ นามสกุล ชื่อเดิม หรือชื่อเล่น" autoComplete="off"/></label>
 {q.trim()&&<div className="pick-results" aria-live="polite">{results.slice(0,30).map(p=><button type="button" key={p.id} onClick={()=>onSelect(p)}><strong>{displayName(p)}</strong><small>{homes.find(h=>h.id===p.home_id)?.name||'ยังไม่ระบุบ้าน'}{p.nickname?' · '+p.nickname:''}</small></button>)}{!results.length&&<p>ไม่พบชื่อตรงกับข้อความนี้</p>}{results.length>30&&<p>พบอีกหลายรายการ กรุณาพิมพ์ชื่อให้เจาะจงขึ้น</p>}</div>}</div>
}
