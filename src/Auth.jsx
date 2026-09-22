import React, { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

function explain(error) {
  if (error.code === 'otp_expired') return 'รหัสไม่ถูกต้องหรือหมดอายุ กรุณาลองอีกครั้งหรือขอรหัสใหม่'
  if (error.status === 429 || error.code?.includes('rate_limit')) return 'ขอรหัสบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่'
  if (error.code === 'email_address_not_authorized') return 'ระบบส่งอีเมลยังไม่พร้อมสำหรับที่อยู่นี้ กรุณาติดต่อผู้ดูแล'
  return error.message || 'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่'
}

export default function Auth() {
  const [email,setEmail]=useState(''),[busy,setBusy]=useState(false),[note,setNote]=useState(''),[error,setError]=useState('')
  const [remaining,setRemaining]=useState(0),[mode,setMode]=useState('password')
  const lock=useRef(false), nextSend=useRef(0)
  useEffect(()=>{
    const timer=setInterval(()=>setRemaining(Math.max(0,Math.ceil((nextSend.current-Date.now())/1000))),1000)
    return ()=>clearInterval(timer)
  },[])
  async function loginLine() {
    if(lock.current)return
    lock.current=true;setBusy(true);setError('')
    try {
      const {error}=await supabase.auth.signInWithOAuth({
        provider:'custom:line-oauth',
        options:{redirectTo:'https://www.saributr.com',scopes:'openid profile',queryParams:{bot_prompt:'aggressive'}}
      })
      if(error)throw error
    }catch(e){setError(explain(e))}
    finally{lock.current=false;setBusy(false)}
  }
  async function send(address) {
    if(lock.current||Date.now()<nextSend.current)return
    lock.current=true;setBusy(true);setError('');setNote('')
    try{
      const {error}=await supabase.auth.signInWithOtp({email:address,options:{shouldCreateUser:true}})
      if(error)throw error
      setEmail(address);nextSend.current=Date.now()+60000;setRemaining(60)
      setNote('ส่งรหัสแล้ว กรุณาตรวจกล่องจดหมายและโฟลเดอร์สแปม ใช้รหัสจากอีเมลล่าสุด')
    }catch(e){setError(explain(e))}finally{lock.current=false;setBusy(false)}
  }
  async function verify(event) {
    event.preventDefault()
    if(lock.current)return
    const token=new FormData(event.currentTarget).get('token').trim()
    if(!/^[0-9]{6,10}$/.test(token)){setError('กรุณากรอกรหัสตัวเลขให้ครบตามอีเมล');return}
    lock.current=true;setBusy(true);setError('');setNote('')
    try{
      const {data,error}=await supabase.auth.verifyOtp({email,token,type:'email'})
      if(error)throw error
      if(!data.session)throw new Error('ยืนยันไม่สำเร็จ กรุณาขอรหัสใหม่')
      // App observes the SIGNED_IN event; no profile is recreated here.
    }catch(e){setError(explain(e))}finally{lock.current=false;setBusy(false)}
  }
  return <main className="auth-page"><section className="auth-card">
    <p>สาริบุตร • สายใยครอบครัว</p>
    <h1>{email?'ยืนยันรหัส OTP':'สมัคร / เข้าสู่ระบบ'}</h1>
    {!email&&<><button className="btn primary" style={{background:'#06C755',color:'#fff',width:'100%',marginBottom:16}} disabled={busy} onClick={loginLine}>สมัคร / เข้าสู่ระบบด้วย LINE</button><p>สมาชิกใหม่เลือกบ้านและชื่อตนเอง แล้วรอ Admin อนุมัติ</p></>}
    {email?<><p>กรอกรหัสที่ส่งไปยัง <strong style={{overflowWrap:'anywhere'}}>{email}</strong></p>
      <form className="form" onSubmit={verify}><label>รหัสจากอีเมล<input key={email} name="token" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} autoFocus required/></label>
      <button className="btn primary" disabled={busy}>{busy?'กำลังดำเนินการ…':'ยืนยันและเข้าสู่ระบบ'}</button></form>
      <div className="otp-actions"><button className="btn secondary" disabled={busy||remaining>0} onClick={()=>send(email)}>{remaining>0?'ส่งรหัสใหม่ได้ใน '+remaining+' วินาที':'ส่งรหัสใหม่'}</button>
      <button className="btn secondary" disabled={busy} onClick={()=>{setEmail('');setError('');setNote('')}}>เปลี่ยนอีเมล</button></div>
    </>:<><div className="actions"><button className="btn secondary" onClick={()=>setMode('password')}>เข้าสู่ระบบด้วยรหัสผ่าน</button><button className="btn secondary" onClick={()=>setMode('otp')}>สมัครใหม่ / ใช้ OTP / ลืมรหัสผ่าน</button></div>
 {mode==='password'?<form className="form" onSubmit={async e=>{e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');try{const f=new FormData(e.currentTarget);const {error}=await supabase.auth.signInWithPassword({email:f.get('email').trim(),password:f.get('password')});if(error)throw error}catch(e){setError(explain(e))}finally{lock.current=false;setBusy(false)}}}><label>อีเมล<input name="email" type="email" autoComplete="email" required/></label><label>รหัสผ่าน<input name="password" type="password" autoComplete="current-password" required/></label><button className="btn primary" disabled={busy}>เข้าสู่ระบบ</button></form>:<><p>ยืนยันอีเมลด้วย OTP ก่อนเลือกบ้านและชื่อตนเอง แล้วส่งคำขอให้ Admin อนุมัติ</p>
      <form className="form" onSubmit={e=>{e.preventDefault();send(new FormData(e.currentTarget).get('email').trim())}}><label>อีเมล<input name="email" type="email" autoComplete="email" required/></label><button className="btn primary" disabled={busy||remaining>0}>{busy?'กำลังส่งรหัส…':remaining>0?'ขอรหัสใหม่ได้ใน '+remaining+' วินาที':'รับรหัส OTP'}</button></form>
      <p>หากลืมรหัสผ่าน ให้ใช้ OTP เข้าบัญชีเดิม แล้วตั้งรหัสผ่านใหม่</p></>}</>}
    {error&&<p className="alert" role="alert">{error}</p>}{note&&<p role="status">{note}</p>}
    <p>Dashboard เปิดให้สมาชิกที่ผ่านการอนุมัติ โดยข้อมูลส่วนตัวจำกัดตามสิทธิ์บ้าน</p>
  </section></main>
}
