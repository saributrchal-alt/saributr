import {JSDOM} from 'jsdom'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'})
for(const k of ['window','document','HTMLElement','Event'])globalThis[k]=dom.window[k]
globalThis.IS_REACT_ACT_ENVIRONMENT=true
const {default:React,act}=await import('react'),{createRoot}=await import('react-dom/client')
const server=await createServer({server:{middlewareMode:true}})
try{
 const {supabase}=await server.ssrLoadModule('/src/supabase.js');let resolve
 supabase.rpc=()=>new Promise(r=>{resolve=r})
 const {default:Details}=await server.ssrLoadModule('/src/PrivateDetails.jsx')
 const root=createRoot(document.getElementById('root'))
 await act(async()=>root.render(React.createElement(Details,{person:{id:'p'},admin:true,own:false})))
 const button=document.querySelector('button')
 const key=type=>button.dispatchEvent(new window.KeyboardEvent(type,{key:' ',bubbles:true}))
 await act(async()=>key('keydown'));await act(async()=>key('keyup'))
 await act(async()=>resolve({data:{phone:'SECRET'}}));assert.ok(!document.body.textContent.includes('SECRET'))
 await act(async()=>key('keydown'));await act(async()=>resolve({data:{phone:'SECRET'}}));assert.ok(document.body.textContent.includes('SECRET'))
 await act(async()=>key('keyup'));assert.ok(!document.body.textContent.includes('SECRET'))
 await act(async()=>root.unmount());console.log('PASS hold to reveal, release hides, late response ignored')
}finally{await server.close()}
