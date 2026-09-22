import React from 'react'
export default function AccountProfile({user}){
 const identity=user.identities?.find(i=>i.provider==='custom:line')
 const profile=identity?.identity_data||user.user_metadata||{}
 const name=profile.name||profile.full_name||profile.display_name
 const picture=profile.picture||profile.avatar_url
 const safePicture=typeof picture==='string'&&picture.startsWith('https://')?picture:null
 return <div className="account-profile">
 {safePicture&&<img src={safePicture} alt="" width="56" height="56" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.hidden=true}}/>}
 <div><strong>{name||user.email||'สมาชิก LINE'}</strong>{name&&user.email&&<small>{user.email}</small>}{identity&&<small>บัญชี LINE</small>}</div>
 </div>
}
