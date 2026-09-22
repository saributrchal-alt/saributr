import React,{useEffect,useState} from 'react'
import {supabase} from './supabase'
import Auth from './Auth'
import Dashboard from './Dashboard'
import RegistrationGate from './Registration'
// Capture provider errors before the auth client cleans up the callback URL.
const callbackParams = typeof window==='undefined' ? new URLSearchParams() : new URLSearchParams(window.location.hash.slice(1))
const queryParams = typeof window==='undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
const callbackError = callbackParams.get('error') || queryParams.get('error')
const callbackMessage = callbackError ? [
 callbackParams.get('error_code') || queryParams.get('error_code') || callbackError,
 callbackParams.get('error_description') || queryParams.get('error_description') || 'ยืนยันตัวตนไม่สำเร็จ'
].join(': ').slice(0,1000) : ''
export default function App(){
 const [session,setSession]=useState(undefined),[error,setError]=useState(callbackMessage)
 useEffect(()=>{let active=true;const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>{if(active)setSession(s)});supabase.auth.getSession().then(({data,error})=>{if(active){if(error)setError(error.message);setSession(data.session)}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false;subscription.unsubscribe()}},[])
 if(error)return <main className="auth-page"><section className="auth-card"><h1>เข้าสู่ระบบไม่สำเร็จ</h1><p>ระบบยืนยันตัวตนส่งข้อผิดพลาดกลับมา กรุณาส่งข้อความด้านล่างให้ผู้ดูแลตรวจสอบ</p><p className="alert" role="alert" style={{overflowWrap:'anywhere'}}>{error}</p><button className="btn primary" onClick={()=>location.replace(location.pathname)}>กลับหน้าเข้าสู่ระบบ</button></section></main>
 if(session===undefined)return <main>กำลังเชื่อมต่อ…</main>
 return session?<RegistrationGate key={session.user.id} user={session.user}><Dashboard user={session.user}/></RegistrationGate>:<Auth/>
}
