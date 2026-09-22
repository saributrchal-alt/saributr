import {JSDOM} from 'jsdom'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'})
for(const k of ['window','document','HTMLElement','Event','FormData'])globalThis[k]=dom.window[k]
globalThis.IS_REACT_ACT_ENVIRONMENT=true
const {default:React,act}=await import('react'),{createRoot}=await import('react-dom/client')
const server=await createServer({server:{middlewareMode:true},plugins:[{name:'stub-map',enforce:'pre',transform(s,id){if(id.endsWith('/HouseMap.jsx'))return 'export default function HouseMap(){return null}'}}]})
const {supabase}=await server.ssrLoadModule('/src/supabase.js')
let state={approved:false,request:{status:'pending'}}
supabase.rpc=async()=>({data:state,error:null})
const {default:Gate}=await server.ssrLoadModule('/src/Registration.jsx')
const root=createRoot(document.getElementById('root'))
await act(async()=>root.render(React.createElement(Gate,{user:{id:'u',email:'test@example.invalid'}},React.createElement('p',null,'PRIVATE DASHBOARD'))))
assert.match(document.body.textContent,/รอ Admin อนุมัติ/);assert.ok(!document.body.textContent.includes('PRIVATE DASHBOARD'))
state={approved:true};await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='ตรวจสอบผลอนุมัติ').click());assert.match(document.body.textContent,/PRIVATE DASHBOARD/)
await act(()=>root.unmount());await server.close();console.log('PASS registration UI gates dashboard until approval');process.exit(0)
