import {JSDOM} from 'jsdom'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const dom=new JSDOM('<div id="root"></div>')
for(const k of ['window','document','HTMLElement','Event','FormData'])globalThis[k]=dom.window[k]
globalThis.IS_REACT_ACT_ENVIRONMENT=true
const {default:React,act}=await import('react'),{createRoot}=await import('react-dom/client')
const server=await createServer({server:{middlewareMode:true}})
const {default:Fields,profileFormValues,parseProfileAddress}=await server.ssrLoadModule('/src/ProfileAddress.jsx')
const root=createRoot(document.getElementById('root'))
await act(()=>root.render(React.createElement('form',null,React.createElement(Fields,{name:'current_address',label:'ที่อยู่ปัจจุบัน',value:'ข้อมูลเดิม'}),React.createElement(Fields,{name:'birthplace',label:'บ้านเกิด',value:'บ้านเกิดเดิม'}))))
assert.equal(profileFormValues(document.querySelector('form')).current_address,'ข้อมูลเดิม')
await act(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='แก้ไขที่อยู่').click())
const selects=()=>document.querySelectorAll('select')
assert.equal(selects()[0].options.length,78)
assert.equal(selects()[1].disabled,true)
async function choose(i,text){const el=selects()[i];await act(()=>{el.value=[...el.options].find(o=>o.text===text).value;el.dispatchEvent(new Event('change',{bubbles:true}))})}
await choose(0,'สกลนคร');await choose(1,'วานรนิวาส');await choose(2,'คูสะคาม')
const data=profileFormValues(document.querySelector('form'));assert.equal(data.birthplace,'บ้านเกิดเดิม');const parsed=parseProfileAddress(data.current_address);assert.equal(parsed.province,'สกลนคร');assert.equal(parsed.district,'วานรนิวาส');assert.equal(parsed.subdistrict,'คูสะคาม')
await choose(0,'กรุงเทพมหานคร');assert.equal(selects()[1].value,'');assert.equal(selects()[2].value,'');assert.equal(document.querySelector('[name=current_address_postal_code]').value,'')
await choose(1,'พระนคร');await choose(2,'พระบรมมหาราชวัง');assert.equal(document.querySelector('[name=current_address_postal_code]').value,'10200')
await act(()=>root.unmount());await server.close();console.log('PASS profile address legacy retention, independent birthplace, structured roundtrip and cascading selections');process.exit(0)
