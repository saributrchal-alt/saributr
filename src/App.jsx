import React,{useEffect,useState} from 'react'
import {supabase} from './supabase'
import Auth from './Auth'
import Dashboard from './Dashboard'
export default function App(){
 const [session,setSession]=useState(undefined),[error,setError]=useState('')
 useEffect(()=>{let active=true;const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>{if(active)setSession(s)});supabase.auth.getSession().then(({data,error})=>{if(active){if(error)setError(error.message);setSession(data.session)}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false;subscription.unsubscribe()}},[])
 if(error)return <main><p role="alert">{error}</p><button onClick={()=>location.reload()}>ลองใหม่</button></main>
 if(session===undefined)return <main>กำลังเชื่อมต่อ…</main>
 return session?<Dashboard key={session.user.id} user={session.user}/>:<Auth/>
}
