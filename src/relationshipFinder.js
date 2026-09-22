import {deriveKinship} from './kinship.js'

// Use only shared fields, so every member receives the same result.
export function findRelationship(from, to, people, relations) {
 const publicPeople=people.map(({birth_date,death_date,...p})=>p)
 const byId=new Map(publicPeople.map(p=>[p.id,p]))
 if(!byId.has(from)||!byId.has(to))return null
 if(from===to)return {label:'เป็นบุคคลเดียวกัน',path:[]}
 const graph=new Map(publicPeople.map(p=>[p.id,[]]))
 const add=(a,b,label,type)=>{if(graph.has(a)&&graph.has(b))graph.get(a).push({from:a,to:b,label,type})}
 for(const r of relations){
  const a=r.person_id,b=r.related_person_id,t=r.relationship_type
  if(t==='father'||t==='mother'){
   add(b,a,t==='father'?'พ่อ':'แม่',t)
   add(a,b,byId.get(b)?.kinship_gender==='male'?'ลูกชาย':byId.get(b)?.kinship_gender==='female'?'ลูกสาว':'ลูก','child')
  }else if(t==='spouse'){add(a,b,'คู่สมรส',t);add(b,a,'คู่สมรส',t)}
  else if(t==='older_sibling'){add(b,a,'พี่','sibling');add(a,b,'น้อง','sibling')}
 }
 const direct=graph.get(from).find(e=>e.to===to)
 if(direct&&direct.type!=='sibling')return {label:direct.label,path:[direct]}
 const derived=deriveKinship(from,publicPeople,relations)
 const sibling=derived.siblings.find(([id])=>id===to)
 const cousin=derived.cousins.find(([id])=>id===to)
 // Breadth-first traversal; visited IDs prevent cycles in marriage networks.
 const queue=[from],previous=new Map([[from,null]])
 for(let i=0;i<queue.length&&!previous.has(to);i++){
  for(const edge of graph.get(queue[i])||[]){if(previous.has(edge.to))continue;previous.set(edge.to,edge);queue.push(edge.to)}
 }
 const path=[]
 if(previous.has(to)){let id=to;while(id!==from){const edge=previous.get(id);path.unshift(edge);id=edge.from}}
 if(sibling)return {label:sibling[1],path}
 if(cousin)return {label:cousin[1],path}
 if(!path.length)return {label:'ยังไม่พบเส้นทางความสัมพันธ์จากข้อมูลที่เชื่อมไว้',path:[]}
 const parent=e=>['father','mother'].includes(e.type)
 let label='เชื่อมโยงกันผ่านเครือญาติ '+path.length+' ขั้น'
 if(path.length===2&&path.every(parent))label=path[0].type==='father'?(path[1].type==='father'?'ปู่':'ย่า'):(path[1].type==='father'?'ตา':'ยาย')
 else if(path.length===2&&path.every(e=>e.type==='child'))label='หลาน (ลูกของลูก)'
 else if(path.length>2&&path.every(parent))label='บรรพบุรุษ '+path.length+' รุ่น'
 else if(path.length>2&&path.every(e=>e.type==='child'))label='ผู้สืบเชื้อสาย '+path.length+' รุ่น'
 return {label,path}
}
