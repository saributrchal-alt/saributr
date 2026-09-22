import React,{useState} from 'react'
export default function PersonAvatar({person}){
 const [failed,setFailed]=useState(null)
 const url=person.avatar_url
 const show=typeof url==='string'&&url.startsWith('https://')&&failed!==url
 return <span className="avatar green" style={{overflow:'hidden'}}>{show?<img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(url)} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:(person.first_name||person.full_name||'?').slice(0,1)}</span>
}
