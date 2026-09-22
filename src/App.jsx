import { useMemo, useState } from 'react'

const people = [
  {id:'father',name:'สมพร สาริบุตร',short:'สมพร',initials:'สพ',relation:'บิดา',level:'parents',place:'วานรนิวาส สกลนคร',born:'ไม่ระบุ',path:'บิดาของคุณ',tone:'green'},
  {id:'mother',name:'เลี่ยง สาริบุตร',short:'เลี่ยง',initials:'ล',relation:'มารดา',level:'parents',place:'สกลนคร',born:'ไม่ระบุ',path:'มารดาของคุณ',tone:'gold'},
  {id:'self',name:'เฉลิมพล สาริบุตร',short:'เฉลิมพล',initials:'ก',relation:'ฉัน',level:'middle',place:'วานรนิวาส สกลนคร',born:'18 พฤศจิกายน 2525',path:'บุคคลตั้งต้นของผังนี้',tone:'green'},
  {id:'sibling',name:'สมาชิกพี่น้อง',short:'พี่น้อง',initials:'พน',relation:'พี่น้อง',level:'middle',place:'สกลนคร',born:'ไม่ระบุ',path:'มีบิดาหรือมารดาร่วมกัน',tone:'gold'},
  {id:'niece',name:'อรุณ สาริบุตร',short:'อรุณ',initials:'อ',relation:'หลาน',level:'children',place:'ไม่ระบุ',born:'ไม่ระบุ',path:'สมาชิกสายลูกหลาน',tone:'green'},
  {id:'nephew',name:'ดารา สาริบุตร',short:'ดารา',initials:'ด',relation:'หลาน',level:'children',place:'ไม่ระบุ',born:'ไม่ระบุ',path:'สมาชิกสายลูกหลาน',tone:'gold'}
]

const menu = [['tree','ผังครอบครัว','⌘'],['members','สมาชิก','◎'],['stories','ภาพและเรื่องเล่า','▧'],['map','แผนที่ญาติ','⌖'],['dates','วันสำคัญ','◷']]

function Avatar({person,large=false}) {
  return <span className={`avatar ${person.tone} ${large?'large':''}`}>{person.initials}</span>
}

function PersonCard({person,selected,onSelect}) {
  return <button className={`person ${selected?'selected':''}`} onClick={()=>onSelect(person.id)} aria-pressed={selected}>
    <Avatar person={person}/><span><strong>{person.name}</strong><small>{person.relation}</small></span>
  </button>
}

function Tree({selectedId,onSelect}) {
  const row = level => people.filter(p=>p.level===level)
  return <section className="tree" aria-label="ผังความสัมพันธ์ครอบครัว">
    <div className="tree-row">{row('parents').map(p=><PersonCard key={p.id} person={p} selected={selectedId===p.id} onSelect={onSelect}/>)}</div>
    <i className="down"/><i className="across"/>
    <div className="tree-row">{row('middle').map(p=><PersonCard key={p.id} person={p} selected={selectedId===p.id} onSelect={onSelect}/>)}</div>
    <i className="down"/><i className="across short"/>
    <div className="tree-row">{row('children').map(p=><PersonCard key={p.id} person={p} selected={selectedId===p.id} onSelect={onSelect}/>)}</div>
  </section>
}

function Facts({person}) {
  return <dl className="facts"><div><dt>บ้านเกิด</dt><dd>{person.place}</dd></div><div><dt>วันเกิด</dt><dd>{person.born}</dd></div><div><dt>ความสัมพันธ์</dt><dd>{person.path}</dd></div></dl>
}

function Modal({title,onClose,children}) {
  return <div className="backdrop" onMouseDown={onClose}><section className="modal" role="dialog" aria-modal="true" onMouseDown={e=>e.stopPropagation()}>
    <header><h2>{title}</h2><button onClick={onClose} aria-label="ปิด">×</button></header>{children}
  </section></div>
}

export default function App(){
  const [selectedId,setSelectedId]=useState('self')
  const [active,setActive]=useState('tree')
  const [query,setQuery]=useState('')
  const [modal,setModal]=useState(null)
  const selected=people.find(p=>p.id===selectedId)||people[2]
  const matches=useMemo(()=>query.trim()?people.filter(p=>(p.name+p.relation+p.place).toLowerCase().includes(query.trim().toLowerCase())):[],[query])

  return <div className="shell">
    <header className="topbar">
      <a className="brand" href="#top"><b>ส</b><span><strong>สายใยครอบครัว</strong><small>ตระกูลสาริบุตร</small></span></a>
      <div className="search"><label><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหาชื่อ ญาติ หรือภูมิลำเนา"/></label>
        {matches.length>0&&<div className="results">{matches.map(p=><button key={p.id} onClick={()=>{setSelectedId(p.id);setQuery('');setActive('tree')}}><Avatar person={p}/><span><strong>{p.name}</strong><small>{p.relation}</small></span></button>)}</div>}
      </div>
      <button className="btn primary invite" onClick={()=>setModal('invite')}>+ เชิญญาติเข้าร่วม</button>
      <button className="profile" onClick={()=>setSelectedId('self')} aria-label="โปรไฟล์ของฉัน">ก</button>
    </header>

    <div className="layout">
      <aside className="sidebar"><nav>{menu.map(([id,label,icon])=><button key={id} className={active===id?'active':''} onClick={()=>setActive(id)}><span>{icon}</span>{label}</button>)}</nav></aside>
      <main id="top">
        <div className="heading"><div><p className="eyebrow">ครอบครัวของฉัน</p><h1>ตระกูลสาริบุตร</h1><p>สมาชิกตัวอย่าง 6 คน · 3 รุ่น · พร้อมขยายเครือญาติ</p></div><button className="btn primary add" onClick={()=>setModal('add')}>+ เพิ่มบุคคล</button></div>
        {active==='tree'?<>
          <div className="toolbar"><button className="chip active">ทั้งหมด</button><button className="chip">สายบิดา</button><button className="chip">สายมารดา</button><span/><button className="chip zoom">−</button><button className="chip zoom">100%</button><button className="chip zoom">+</button></div>
          <Tree selectedId={selectedId} onSelect={setSelectedId}/>
          <div className="mobile-summary"><Avatar person={selected}/><span><strong>{selected.name}</strong><small>{selected.path}</small></span><button className="btn primary small" onClick={()=>setModal('profile')}>เปิด</button></div>
        </>:<section className="placeholder"><b>{menu.find(i=>i[0]===active)?.[2]}</b><h2>{menu.find(i=>i[0]===active)?.[1]}</h2><p>เตรียมไว้สำหรับเชื่อมข้อมูลจริงในขั้นต่อไป</p><button className="btn secondary" onClick={()=>setActive('tree')}>กลับไปผังครอบครัว</button></section>}
      </main>
      <aside className="details"><div className="identity"><Avatar person={selected} large/><h2>{selected.name}</h2><em>{selected.relation==='ฉัน'?'โปรไฟล์ของฉัน':selected.relation}</em></div><Facts person={selected}/><button className="btn secondary full" onClick={()=>setModal('profile')}>ดูโปรไฟล์ฉบับเต็ม</button></aside>
    </div>

    <nav className="mobile-nav">{menu.slice(0,4).map(([id,label,icon])=><button key={id} className={active===id?'active':''} onClick={()=>setActive(id)}><span>{icon}</span><small>{label==='ภาพและเรื่องเล่า'?'เรื่องราว':label}</small></button>)}</nav>

    {modal==='add'&&<Modal title="เพิ่มบุคคลในครอบครัว" onClose={()=>setModal(null)}><form className="form" onSubmit={e=>{e.preventDefault();setModal(null)}}><label>ชื่อและนามสกุล<input required placeholder="เช่น สมชาย สาริบุตร"/></label><label>ความสัมพันธ์<select defaultValue="parent"><option value="parent">พ่อหรือแม่</option><option value="spouse">คู่สมรส</option><option value="child">ลูก</option><option value="sibling">พี่น้อง</option><option value="other">ญาติอื่น ๆ</option></select></label><p>รุ่นนี้เป็นหน้าตัวอย่าง ข้อมูลจริงจะเชื่อมฐานข้อมูลในขั้นถัดไป</p><button className="btn primary full">บันทึกข้อมูลตัวอย่าง</button></form></Modal>}
    {modal==='invite'&&<Modal title="เชิญญาติเข้าร่วม" onClose={()=>setModal(null)}><div className="invite-card"><div className="qr">QR</div><p>ส่งลิงก์หรือ QR Code ให้ญาติเข้ามายืนยันตัวตนและดูแลโปรไฟล์ของตนเอง</p><button className="btn primary full" onClick={()=>setModal(null)}>คัดลอกลิงก์เชิญตัวอย่าง</button></div></Modal>}
    {modal==='profile'&&<Modal title="รายละเอียดสมาชิก" onClose={()=>setModal(null)}><div className="profile-modal"><Avatar person={selected} large/><h3>{selected.name}</h3><em>{selected.relation}</em><Facts person={selected}/></div></Modal>}
  </div>
}
