import {JSDOM} from 'jsdom'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const dom=new JSDOM('<div id="root"></div>',{url:'https://example.com'})
for(const k of ['window','document','HTMLElement','Event'])globalThis[k]=dom.window[k]
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true})
dom.window.HTMLMediaElement.prototype.play=()=>Promise.resolve()
globalThis.IS_REACT_ACT_ENVIRONMENT=true
const {default:React,act}=await import('react'),{createRoot}=await import('react-dom/client')
const server=await createServer({server:{middlewareMode:true}})
try{
 const {default:Camera}=await server.ssrLoadModule('/src/CameraCapture.jsx');let resolve,stops=0
 navigator.mediaDevices={getUserMedia:()=>new Promise(r=>resolve=r)}
 const root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(Camera,{onPhoto:()=>{}})))
 const click=label=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent===label).click()
 await act(async()=>click('เปิดกล้องถ่ายรูป'));await act(async()=>click('ยกเลิก'))
 await act(async()=>resolve({getTracks:()=>[{stop:()=>stops++}]}));assert.equal(stops,1);assert.equal(document.querySelector('video'),null)
 await act(async()=>click('เปิดกล้องถ่ายรูป'));await act(async()=>resolve({getTracks:()=>[{stop:()=>stops++}]}));assert.ok(document.querySelector('video'))
 await act(async()=>root.unmount());assert.equal(stops,2)
 console.log('PASS camera cancel pending request and stop tracks on unmount')
}finally{await server.close();process.exit(0)}
