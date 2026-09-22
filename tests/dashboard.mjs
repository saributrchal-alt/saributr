import {JSDOM} from 'jsdom'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'})
for(const key of ['window','document','HTMLElement','Event','MouseEvent','FormData'])globalThis[key]=dom.window[key]
globalThis.IS_REACT_ACT_ENVIRONMENT=true
const {default:React,act}=await import('react'),{createRoot}=await import('react-dom/client')
const server=await createServer({server:{middlewareMode:true},plugins:[{name:'map-test-stub',enforce:'pre',transform(src,id){if(id.endsWith('/HouseMap.jsx'))return 'export default function HouseMap(){return null}'}}]})
const {supabase}=await server.ssrLoadModule('/src/supabase.js')
const db={is_admin:false,account:{home_id:'h1',person_id:'p1'},homes:[{id:'h1',name:'บ้านหนึ่ง',can_edit:true,member_count:1},{id:'h2',name:'บ้านสอง',can_edit:false,member_count:1}],people:[{id:'p1',home_id:'h1',full_name:'นาย หนึ่ง ใจดี',name_title:'นาย',first_name:'หนึ่ง',last_name:'ใจดี',kinship_gender:'male',can_edit:true},{id:'p2',home_id:'h2',full_name:'นาง สอง ใจงาม',name_title:'นาง',first_name:'สอง',last_name:'ใจงาม',birth_last_name:'เก่า',kinship_gender:'female',can_edit:false}],relations:[],requests:[]}
let sent=[]
supabase.rpc=async(name,args)=>name==='family_dashboard'?{data:db,error:null}:(sent.push(args),{data:{id:'new'},error:null})
const {default:Dashboard,linkPermitted}=await server.ssrLoadModule('/src/Dashboard.jsx')
assert.ok(linkPermitted(db,db.people[0],db.people[1],'mother'))
assert.ok(!linkPermitted(db,db.people[0],db.people[1],'child'))
assert.ok(!linkPermitted(db,db.people[0],db.people[1],'older_sibling'))
const root=createRoot(document.getElementById('root'))
await act(async()=>root.render(React.createElement(Dashboard,{user:{id:'u1',email:'test@example.invalid'}})))
const button=(text,scope=document)=>[...scope.querySelectorAll('button')].find(b=>b.textContent.includes(text))
const click=async(text,scope)=>{const b=button(text,scope);assert.ok(b,'missing button '+text);await act(async()=>b.click())}
async function type(selector,value){const node=document.querySelector(selector);assert.ok(node,selector);await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(node,value);node.dispatchEvent(new dom.window.Event('input',{bubbles:true}))})}
assert.match(document.body.textContent,/Dashboard ครอบครัว/)
await click('เลือกชื่อ / + เพิ่มมารดา')
await type('.people-picker input','เก่า')
assert.match(document.querySelector('.pick-results').textContent,/บ้านสอง/)
await click('นาง สอง',document.querySelector('.pick-results'))
await click('ใช้บุคคลนี้')
assert.deepEqual(sent.at(-1),{action:'link',payload:{person_id:'p2',related_person_id:'p1',relationship_type:'mother'}})
await click('+ เพิ่ม',document.querySelector('.members-panel'))
await type('input[name="first_name"]','สอง')
assert.match(document.querySelector('.pick-results').textContent,/นาง สอง/)
assert.ok(button('บันทึกข้อมูล').disabled)
await click('นาง สอง',document.querySelector('.pick-results'))
assert.equal(document.querySelector('.modal'),null)
assert.match(document.querySelector('.person-panel').textContent,/อ่านอย่างเดียว/)
assert.equal(button('แก้ไข',document.querySelector('.person-panel')),undefined)
assert.equal(button('เลือกชื่อ',document.querySelector('.person-panel')),undefined)
assert.match(document.querySelector('.person-panel').textContent,/เป็นข้อมูลสงวน/)
await act(async()=>root.unmount())
await server.close()
console.log('PASS UI: self cross-home parent picker, birth-name autocomplete, duplicate guard, existing-person selection, read-only other home (map stubbed)')
process.exit(0)
