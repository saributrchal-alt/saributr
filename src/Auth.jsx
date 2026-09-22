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
  const [remaining,setRemaining]=useState(0)
  const lock=useRef(false), nextSend=useRef(0)
  useEffect(()=>{
    const timer=setInterval(()=>setRemaining(Math.max(0,Math.ceil((nextSend.current-Date.now())/1000))),1000)
    return ()=>clearInterval(timer)
  },[])
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
    {email?<><p>กรอกรหัสที่ส่งไปยัง <strong style={{overflowWrap:'anywhere'}}>{email}</strong></p>
      <form className="form" onSubmit={verify}><label>รหัสจากอีเมล<input key={email} name="token" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} autoFocus required/></label>
      <button className="btn primary" disabled={busy}>{busy?'กำลังดำเนินการ…':'ยืนยันและเข้าสู่ระบบ'}</button></form>
      <div className="otp-actions"><button className="btn secondary" disabled={busy||remaining>0} onClick={()=>send(email)}>{remaining>0?'ส่งรหัสใหม่ได้ใน '+remaining+' วินาที':'ส่งรหัสใหม่'}</button>
      <button className="btn secondary" disabled={busy} onClick={()=>{setEmail('');setError('');setNote('')}}>เปลี่ยนอีเมล</button></div>
    </>:<><p>รับรหัสยืนยันทางอีเมล โดยไม่ต้องตั้งรหัสผ่าน</p>
      <form className="form" onSubmit={e=>{e.preventDefault();send(new FormData(e.currentTarget).get('email').trim())}}><label>อีเมล<input name="email" type="email" autoComplete="email" required/></label><button className="btn primary" disabled={busy||remaining>0}>{busy?'กำลังส่งรหัส…':remaining>0?'ขอรหัสใหม่ได้ใน '+remaining+' วินาที':'รับรหัส OTP'}</button></form>
      <p>สมาชิกเดิมใช้อีเมลเดิมเพื่อเข้าถึงข้อมูลครอบครัว สมาชิกใหม่ใช้ขั้นตอนเดียวกันเพื่อเริ่มใช้งาน</p></>}
    {error&&<p className="alert" role="alert">{error}</p>}{note&&<p role="status">{note}</p>}
    <p>ข้อมูลครอบครัวเห็นได้เฉพาะบัญชีของคุณ</p>
  </section></main>
}
