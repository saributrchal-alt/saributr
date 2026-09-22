import React,{useState} from 'react'
import ThaiAddressFields from './ThaiAddressFields'
export function parseProfileAddress(value=''){
 const match=value.match(/^(.*?)\nตำบล\/แขวง: (.*?)\nอำเภอ\/เขต: (.*?)\nจังหวัด: (.*?)\nรหัสไปรษณีย์: (\d{5})$/s)
 return match?{address_line:match[1],subdistrict:match[2],district:match[3],province:match[4],postal_code:match[5]}:null
}
export function profileFormValues(form){
 const values=Object.fromEntries(new FormData(form))
 for(const key of ['birthplace','current_address']){
  if(values[key+'_editing']==='yes')values[key]=`${values[key+'_address_line']||''}\nตำบล/แขวง: ${values[key+'_subdistrict']}\nอำเภอ/เขต: ${values[key+'_district']}\nจังหวัด: ${values[key+'_province']}\nรหัสไปรษณีย์: ${values[key+'_postal_code']}`
  for(const field of Object.keys(values))if(field.startsWith(key+'_'))delete values[field]
 }
 return values
}
export default function ProfileAddress({name,label,value=''}){
 const parsed=parseProfileAddress(value),[editing,setEditing]=useState(false),[cleared,setCleared]=useState(false)
 return <fieldset className="profile-address"><legend>{label}</legend>{editing?<><input type="hidden" name={name+'_editing'} value="yes"/><label>บ้านเลขที่ หมู่บ้าน ถนน / รายละเอียดสถานที่<input name={name+'_address_line'} maxLength={500} defaultValue={parsed?.address_line||''}/></label><ThaiAddressFields house={parsed} prefix={name+'_'} />{value&&!parsed&&<p>ข้อมูลเดิม: {value}</p>}<button className="btn secondary" type="button" onClick={()=>setEditing(false)}>ยกเลิกการแก้ไขที่อยู่</button></>:<><input type="hidden" name={name} value={cleared?'':value}/><p style={{whiteSpace:'pre-line'}}>{cleared||!value?'ยังไม่ระบุ':value}</p><div className="actions"><button className="btn secondary" type="button" onClick={()=>{setEditing(true);setCleared(false)}}>{value&&!cleared?'แก้ไขที่อยู่':'เลือกที่อยู่'}</button>{value&&!cleared&&<button className="btn secondary" type="button" onClick={()=>setCleared(true)}>ล้างที่อยู่</button>}</div></>}</fieldset>
}
