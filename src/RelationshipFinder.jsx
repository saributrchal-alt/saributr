import React,{useMemo,useState} from 'react'
import PeoplePicker from './PeoplePicker'
import {displayName} from './personNames'
import {findRelationship} from './relationshipFinder'
export default function RelationshipFinder({people,homes,relations}) {
 const [ids,setIds]=useState(['','']),[queries,setQueries]=useState(['',''])
 const selected=ids.map(id=>people.find(p=>p.id===id))
 const result=useMemo(()=>findRelationship(ids[0],ids[1],people,relations),[ids,people,relations])
 const name=id=>displayName(people.find(p=>p.id===id))
 return <section className="relationship-finder" aria-labelledby="relationship-finder-title">
 <h2 id="relationship-finder-title">ค้นหาความสัมพันธ์</h2>
 <p>เลือกสองคนเพื่อดูว่าเกี่ยวข้องกันอย่างไร ใช้ได้กับสมาชิกทุกบ้าน</p>
 <div className="relationship-searches">{[0,1].map(i=><div key={i}><PeoplePicker label={'บุคคลที่ '+(i+1)} people={people} homes={homes} value={queries[i]} onChange={q=>{setQueries(v=>v.map((x,j)=>j===i?q:x));setIds(v=>v.map((x,j)=>j===i?'':x))}} onSelect={p=>{setIds(v=>v.map((x,j)=>j===i?p.id:x));setQueries(v=>v.map((x,j)=>j===i?'':x))}}/>{selected[i]&&<p className="chosen-person"><strong>{displayName(selected[i])}</strong><small>{homes.find(h=>h.id===selected[i].home_id)?.name}</small></p>}</div>)}</div>
 <button type="button" className="btn secondary" disabled={!ids[0]||!ids[1]} onClick={()=>{setIds(([a,b])=>[b,a]);setQueries(['',''])}}>สลับบุคคล</button>
 <div aria-live="polite">{result&&<div className="relationship-result"><p><strong>{name(ids[1])}</strong> เมื่อเทียบกับ <strong>{name(ids[0])}</strong></p><h3>{result.label}</h3>{result.path.length>0&&<><p>เส้นทางที่เชื่อมไว้</p><ol>{result.path.map((edge,i)=><li key={i}>{name(edge.to)} เป็น<strong>{edge.label}</strong>ของ {name(edge.from)}</li>)}</ol></>}</div>}</div>
 <p className="map-caption">คำนวณจากข้อมูลที่เชื่อมไว้เท่านั้น หากยังไม่พบเส้นทาง ไม่ได้หมายความว่าไม่เป็นญาติกัน · ไม่ใช้วันเกิดที่สงวนไว้ในการคำนวณลำดับอายุ</p>
 </section>
}
