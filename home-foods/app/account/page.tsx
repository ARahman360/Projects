'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import AccountProfile from '@/src/components/account-profile';
import SavedAddresses from '@/src/components/saved-addresses';
import {canBuy} from '@/src/lib/buyer-policy';
type User={id:number;role:string;name:string|null;email:string;phone?:string|null;avatarUrl?:string|null};
export default function AccountPage(){
 const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true),[kitchen,setKitchen]=useState<{name:string;address:string|null}|null>(null),[error,setError]=useState('');
 const load=useCallback(async()=>{try{const response=await fetch('/api/auth',{cache:'no-store'}),data=await response.json();setUser(data.user??null);if(data.user?.role==='SELLER'){const r=await fetch('/api/addresses',{cache:'no-store'}),a=await r.json();setKitchen(a.kitchen??null);}}catch{setError('Could not load your account. Please refresh.');}finally{setLoading(false);}},[]);
 useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer);},[load]);
 return <main id="main-content" className="workspace-shell"><div className="workspace-section-heading"><div><span className="eyebrow">YOUR HOMEFOODS</span><h1>Manage Account</h1></div></div>{error&&<p role="alert">{error}</p>}{loading?<p role="status">Loading account…</p>:user?<><AccountProfile user={user} onSaved={load}/>{kitchen&&<section className="workspace-card"><h2>Operational kitchen address</h2><b>{kitchen.name}</b><p>{kitchen.address||'No kitchen address yet.'}</p><p>Personal delivery choices do not change this location.</p><Link href="/workspace#kitchen-settings">Manage kitchen address →</Link></section>}{canBuy(user.role)&&<SavedAddresses/>}</>:<Link href="/signin?returnTo=%2Faccount">Sign in to manage your account</Link>}</main>;
}
