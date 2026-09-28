"use client";
import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
type Profile={id:number;name:string|null;email:string;phone?:string|null;avatarUrl?:string|null;role:string;createdAt?:string};
export default function AccountProfile({user,onSaved}:{user:Profile;onSaved:()=>Promise<void>}){
 const [editing,setEditing]=useState(false),[security,setSecurity]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[dirty,setDirty]=useState(false);
 useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>e.preventDefault();window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 async function save(e:FormEvent<HTMLFormElement>,action:string){
  e.preventDefault();const form=e.currentTarget;setBusy(true);setError('');setNotice('');
  try{const response=await fetch('/api/account',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...Object.fromEntries(new FormData(form))})});const data=await response.json();if(!response.ok)throw Error(data.error);setNotice(data.message);form.reset();if(action==='profile'){setDirty(false);setEditing(false);}window.dispatchEvent(new Event('homefoods:account-change'));await onSaved();}catch(e){setError(e instanceof Error?e.message:'Could not save.');}finally{setBusy(false);}
 }
 return <section id="profile" className="account-profile">
 <div className="account-summary"><span className="account-avatar" style={user.avatarUrl?{backgroundImage:`url(${JSON.stringify(user.avatarUrl)})`}:undefined}>{!user.avatarUrl&&(user.name??'HF').split(/\s+/).map(s=>s[0]).slice(0,2).join('')}</span><div><span className="eyebrow">YOUR ACCOUNT</span><h2>{user.name||'HomeFoods member'}</h2><p>{user.email}</p>{user.phone&&<p>{user.phone}</p>}<span className="status-pill">{user.role.toLowerCase()}</span></div><button disabled={busy} onClick={()=>{setEditing(true);setError('');}} aria-expanded={editing}>Edit Profile</button></div>
 {notice&&<p role="status" className="workspace-notice">{notice}</p>}{error&&<p role="alert" className="workspace-alert">{error}</p>}
 {editing&&<form className="account-form" onSubmit={e=>void save(e,'profile')} onChange={()=>setDirty(true)}><label>Full name<input name="name" required minLength={2} maxLength={100} defaultValue={user.name??''} autoComplete="name"/></label><label>Phone number<input name="phone" maxLength={40} defaultValue={user.phone??''} autoComplete="tel" type="tel"/></label><p>Your role is managed by HomeFoods. Your email is read-only. Password changes are available below.</p><div className="account-actions"><button className="dark-cta" disabled={busy}>Save Changes</button><button type="button" disabled={busy} onClick={()=>{setEditing(false);setDirty(false);setError('');}}>Cancel</button></div></form>}
 <button className="account-security-toggle" aria-expanded={security} onClick={()=>setSecurity(!security)}>Account Security <span>{security?'−':'+'}</span></button>
 {security&&<div className="account-security">
 <form className="account-form" onSubmit={e=>void save(e,'password')}><h3>Change password</h3><label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={200}/></label><label>New password<input name="newPassword" type="password" autoComplete="new-password" required minLength={10} maxLength={200}/></label><button disabled={busy}>Update password</button><Link href="/forgot-password">Forgot your password?</Link></form>

 </div>}</section>;
}
