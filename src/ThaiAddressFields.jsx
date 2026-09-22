import React,{useState} from 'react'
import areas from './data/thai-addresses.json'
const norm=s=>(s||'').trim().replace(/^(จังหวัด|อำเภอ|ตำบล|เขต|แขวง|จ\.|อ\.|ต\.)\s*/,'')
export default function ThaiAddressFields({house}){
 const initialProvince=areas.find(p=>p.name===norm(house?.province))
 const initialDistrict=initialProvince?.districts.find(d=>d.name===norm(house?.district))
 const initialSub=initialDistrict?.subdistricts.find(s=>s.name===norm(house?.subdistrict))
 const [province,setProvince]=useState(initialProvince?.id||''),[district,setDistrict]=useState(initialDistrict?.id||''),[sub,setSub]=useState(initialSub?.id||''),[zip,setZip]=useState(house?.postal_code||initialSub?.zip||'')
 const p=areas.find(x=>x.id===Number(province)),d=p?.districts.find(x=>x.id===Number(district)),s=d?.subdistricts.find(x=>x.id===Number(sub))
 const legacy=house&&(house.province||house.district||house.subdistrict)&&(!initialProvince||!initialDistrict||!initialSub)
 const sorted=xs=>[...(xs||[])].sort((a,b)=>a.name.localeCompare(b.name,'th'))
 return <>
 {legacy&&<p className="privacy-note">ที่อยู่เดิม: {[house.subdistrict,house.district,house.province].filter(Boolean).join(' · ')} กรุณาเลือกพื้นที่จากรายการก่อนบันทึก</p>}
 <label>จังหวัด<select required value={province} onChange={e=>{setProvince(e.target.value);setDistrict('');setSub('');setZip('')}}><option value="">เลือกจังหวัด</option>{sorted(areas).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
 <label>อำเภอ / เขต<select required disabled={!p} value={district} onChange={e=>{setDistrict(e.target.value);setSub('');setZip('')}}><option value="">เลือกอำเภอ / เขต</option>{sorted(p?.districts).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
 <label>ตำบล / แขวง<select required disabled={!d} value={sub} onChange={e=>{setSub(e.target.value);setZip(d.subdistricts.find(x=>x.id===Number(e.target.value))?.zip||'')}}><option value="">เลือกตำบล / แขวง</option>{sorted(d?.subdistricts).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
 <input type="hidden" name="province" value={p?.name||''}/><input type="hidden" name="district" value={d?.name||''}/><input type="hidden" name="subdistrict" value={s?.name||''}/>
 <label>รหัสไปรษณีย์<input name="postal_code" required inputMode="numeric" pattern="[0-9]{5}" maxLength={5} value={zip} onChange={e=>setZip(e.target.value)}/></label><small>เติมรหัสจากพื้นที่ที่เลือก ตรวจสอบให้ตรงกับที่อยู่จัดส่งจริง</small>
 </>
}
