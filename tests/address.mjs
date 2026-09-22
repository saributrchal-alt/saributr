import {JSDOM} from 'jsdom'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const dom=new JSDOM('<div id="root"></div>')
for(const k of ['window','document','HTMLElement','Event','FormData'])globalThis[k]=dom.window[k]
globalThis.IS_REACT_ACT_ENVIRONMENT=true
const {default:React,act}=await import('react'),{createRoot}=await import('react-dom/client')
const server=await createServer({server:{middlewareMode:true}})
const {default:Fields}=await server.ssrLoadModule('/src/ThaiAddressFields.jsx')
const root=createRoot(document.getElementById('root'))
await act(()=>root.render(React.createElement('form',null,React.createElement(Fields))))
const selects=()=>document.querySelectorAll('select')
assert.equal(selects()[0].options.length,78)
assert.equal(selects()[1].disabled,true)
async function choose(i,text){const el=selects()[i];await act(()=>{el.value=[...el.options].find(o=>o.text===text).value;el.dispatchEvent(new Event('change',{bubbles:true}))})}
await choose(0,'สกลนคร');await choose(1,'วานรนิวาส');await choose(2,'คูสะคาม')
const data=new FormData(document.querySelector('form'))
assert.equal(data.get('province'),'สกลนคร');assert.equal(data.get('district'),'วานรนิวาส');assert.equal(data.get('subdistrict'),'คูสะคาม');assert.match(data.get('postal_code'),/^\d{5}$/)
await choose(0,'กรุงเทพมหานคร');assert.equal(selects()[1].value,'');assert.equal(selects()[2].value,'');assert.equal(document.querySelector('[name=postal_code]').value,'')
await choose(1,'พระนคร');await choose(2,'พระบรมมหาราชวัง');assert.equal(document.querySelector('[name=postal_code]').value,'10200')
await act(()=>root.unmount());await server.close();console.log('PASS cascading address selections, submission names, reset and Bangkok');process.exit(0)
