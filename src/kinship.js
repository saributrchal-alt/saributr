import { siblingRole } from './nameTitle.js'

// Derived relationships are never persisted: editing a parent updates the result.
export function deriveKinship(selected, people, relations) {
  const byId = new Map(people.map(p => [p.id, p]))
  const parents = new Map(people.map(p => [p.id, {father: new Set(), mother: new Set()}]))
  const manual = relations.filter(r => r.relationship_type === 'older_sibling')
  for (const r of relations) {
    if (r.relationship_type === 'father' || r.relationship_type === 'mother')
      parents.get(r.related_person_id)?.[r.relationship_type].add(r.person_id)
  }
  const info = id => parents.get(id) || {father: new Set(), mother: new Set()}
  const all = id => [...info(id).father, ...info(id).mother]
  const overlap = (a,b) => [...a].some(id => b.has(id))
  const explicit = (a,b) => manual.find(r => (r.person_id===a && r.related_person_id===b) || (r.person_id===b && r.related_person_id===a))
  function sibling(a,b) {
    if (a===b) return null
    const x=info(a), y=info(b), recorded=explicit(a,b)
    const sameFather=overlap(x.father,y.father), sameMother=overlap(x.mother,y.mother)
    const ambiguous=[x.father,x.mother,y.father,y.mother].some(s=>s.size>1)
    if (ambiguous) return sameFather||sameMother||recorded ? 'ข้อมูลพ่อแม่ขัดแย้ง กรุณาตรวจสอบ' : null
    if (sameFather && sameMother) return 'พี่น้องแท้ ๆ'
    if (sameMother && x.father.size && y.father.size) return 'พี่น้องคนละพ่อ'
    if (sameFather && x.mother.size && y.mother.size) return 'พี่น้องคนละแม่'
    if (sameFather || sameMother) return 'พี่น้อง — ข้อมูลพ่อแม่ยังไม่ครบ'
    if (recorded) return 'พี่น้องที่ระบุเอง — ยังยืนยันประเภทจากพ่อแม่ไม่ได้'
    return null
  }
  function ancestor(a,b) {
    const seen=new Set(), todo=all(b)
    while(todo.length) {const id=todo.pop(); if(id===a)return true; if(seen.has(id))continue; seen.add(id);todo.push(...all(id))}
    return false
  }
  function order(a,b) {
    const pa=byId.get(a),pb=byId.get(b),ranked=Number.isFinite(pa?.age_order)&&Number.isFinite(pb?.age_order)
    const x=ranked?pa.age_order:pa?.birth_date,y=ranked?pb.age_order:pb?.birth_date,r=explicit(a,b)
    const fromDate=x&&y&&x!==y ? (y<x?'พี่':'น้อง') : null
    const fromRecord=r ? (r.person_id===b?'พี่':'น้อง') : null
    if(fromDate&&fromRecord&&fromDate!==fromRecord)return 'ลำดับที่ระบุขัดกับวันเกิด'
    return siblingRole(fromRecord||fromDate||(x&&y&&x===y?'เกิดวันเดียวกัน ยังไม่ระบุลำดับ':'ยังไม่ทราบลำดับอายุ'), byId.get(b)?.full_name, byId.get(b)?.kinship_gender)
  }
  const siblings=[], cousins=[]
  for(const p of people) {
    if(p.id===selected)continue
    const kind=sibling(selected,p.id)
    if(kind){siblings.push([p.id,kind+' · '+order(selected,p.id)]);continue}
    if(ancestor(selected,p.id)||ancestor(p.id,selected))continue
    // First cousins: a parent on each side is a sibling, including half siblings.
    const paths=[]
    for(const a of all(selected))for(const b of all(p.id)) {
      const relationship=sibling(a,b)
      if(relationship && !relationship.includes('ขัดแย้ง'))paths.push([a,b,relationship])
    }
    if(paths.length) {
      const [a,b,relationship]=paths[0]
      cousins.push([p.id,'ลูกพี่ลูกน้อง · '+order(selected,p.id)+' · '+(byId.get(a)?.full_name||'ผู้ปกครอง')+' กับ '+(byId.get(b)?.full_name||'ผู้ปกครอง')+' เป็น'+relationship])
    }
  }
  return {siblings,cousins}
}
