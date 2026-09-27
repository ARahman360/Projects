"use client";

import {createContext, useContext, useEffect, useRef, useState, type ReactNode, type ComponentProps} from 'react';
import {usePathname, useRouter} from 'next/navigation';
import Link from 'next/link';
import Brand from './brand';
import OverlayLayer from './overlay-layer';
import LocationSelector from './location-selector';
import NavigationIcon from './navigation-icon';
import {ThemeToggle} from './site-enhancements';
import {accountHref, workspaceDefaultHash, accountNavigation, discoveryNavigation, isNavigationActive, personalNavigation, roleDestinations, roleLabels, type AccountRole, type NavigationItem} from '@/src/lib/navigation';

type User = {id:number;name:string|null;email:string;role:AccountRole;avatarUrl?:string|null};
type NavigationContext = {ready:boolean;open:boolean;toggle:()=>void;trigger:React.RefObject<HTMLButtonElement|null>;user:User|null};
const Navigation = createContext<NavigationContext|null>(null);
const authPaths = ['/signin','/join','/forgot-password','/reset-password','/account-recovery'];
export function useNavigationLocation() {
 const pathname=usePathname();const [hash,setHash]=useState('');
 useEffect(()=>{const sync=()=>setHash(window.location.hash);sync();window.addEventListener('hashchange',sync);window.addEventListener('popstate',sync);return()=>{window.removeEventListener('hashchange',sync);window.removeEventListener('popstate',sync);};},[pathname]);
 return {pathname,hash};
}
function NavigationLink({href,...props}:ComponentProps<'a'> & {href:string}) {
 const pathname=usePathname();
 // Native same-page anchors emit hashchange; Next client routing does not.
 return href.includes('#') && href.split('#')[0]===pathname ? <a href={href} {...props}/> : <Link href={href} {...props}/>;
}
export function SecondaryNavigation({items,label}:{items:NavigationItem[];label:string}) {
 const {pathname,hash}=useNavigationLocation();
 return <nav className="app-section-nav" aria-label={label}>{items.map((item,index)=><NavigationLink key={item.href} href={item.href} aria-current={isNavigationActive(item.href,pathname,hash)||(pathname==='/workspace'&&!hash&&index===0)?'page':undefined}><NavigationIcon name={item.icon}/>{item.label}</NavigationLink>)}</nav>;
}
function Avatar({user}:{user:User}) {return <span className="app-avatar" style={user.avatarUrl?{backgroundImage:`url(${JSON.stringify(user.avatarUrl)})`}:undefined}>{!user.avatarUrl && (user.name||user.email).trim().split(/\s+/).map(n=>n[0]).slice(0,2).join('').toUpperCase()}</span>;}
export function AppHeader({children,cartAction}:{children?:ReactNode;cartAction?:ReactNode}) {
 const nav=useContext(Navigation);const [cartCount,setCartCount]=useState(0);
 useEffect(()=>{const sync=()=>{try{const lines=JSON.parse(localStorage.getItem(`home-foods-cart:${nav?.user?.role==='CUSTOMER'?nav.user.id:'guest'}`)||'[]');setCartCount(Array.isArray(lines)?lines.reduce((sum:number,line:{quantity:number})=>sum+Number(line.quantity||0),0):0);}catch{setCartCount(0);}};sync();window.addEventListener('storage',sync);window.addEventListener('homefoods:cart-change',sync);window.addEventListener('focus',sync);return()=>{window.removeEventListener('storage',sync);window.removeEventListener('homefoods:cart-change',sync);window.removeEventListener('focus',sync);};},[nav?.user?.id,nav?.user?.role]);
 return <header className="app-header"><button ref={nav?.trigger} className="app-menu-button" type="button" disabled={!nav?.ready} aria-label={nav?.open?'Close navigation menu':'Open navigation menu'} aria-expanded={nav?.open??false} onClick={nav?.toggle}><NavigationIcon name="menu"/></button><Brand href="/"/>{children??<><LocationSelector/><form className="app-search" action="/"><NavigationIcon name="search"/><input className="search-field" name="q" aria-label="Search all of HomeFoods" placeholder="Search dishes, kitchens, and more"/></form></>}<div className="app-header-actions">{nav?.user?<NavigationLink href={accountHref} aria-label={`Open ${nav.user.name||'your'} profile`}><Avatar user={nav.user}/></NavigationLink>:<><Link href="/signin" className="app-signin">Sign in</Link><Link href="/join" className="app-join">Join</Link></>}{cartAction??<Link className="app-cart" href="/?cart=open" aria-label={`Open cart${cartCount?`, ${cartCount} items`:''}`}><NavigationIcon name="cart"/>{cartCount>0&&<span>{cartCount}</span>}</Link>}</div></header>;
}
export default function AppShell({children}:{children:ReactNode}) {
 const {pathname,hash}=useNavigationLocation();const router=useRouter();
 const [ready,setReady]=useState(false);
 const [user,setUser]=useState<User|null>(null),[open,setOpen]=useState(false),[closing,setClosing]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [confirmRiderSignOut,setConfirmRiderSignOut]=useState(false);
 const trigger=useRef<HTMLButtonElement|null>(null),dialog=useRef<HTMLElement|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const standalone=authPaths.includes(pathname);
 useEffect(()=>{
  let controller:AbortController|undefined;
  const refresh=()=>{controller?.abort();controller=new AbortController();void fetch('/api/auth',{cache:'no-store',signal:controller.signal}).then(r=>r.json()).then(d=>{setUser(d.user??null);setReady(true);}).catch(e=>{if(e.name!=='AbortError'){setUser(null);setReady(true);}});};
  refresh();window.addEventListener('homefoods:account-change',refresh);window.addEventListener('focus',refresh);
  return()=>{controller?.abort();window.removeEventListener('homefoods:account-change',refresh);window.removeEventListener('focus',refresh);};
 },[pathname]);
 const previousDestination=useRef(`${pathname}${hash}`);
 useEffect(()=>{const destination=`${pathname}${hash}`;if(previousDestination.current===destination)return;previousDestination.current=destination;if(timer.current)clearTimeout(timer.current);const frame=requestAnimationFrame(()=>{setOpen(false);setClosing(false);});return()=>cancelAnimationFrame(frame);},[pathname,hash]);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 function close(){if(closing)return;setClosing(true);timer.current=setTimeout(()=>{setOpen(false);setClosing(false);},window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:180);}
 async function signOut(){if(!window.dispatchEvent(new Event('homefoods:before-signout',{cancelable:true})))return;setBusy(true);setError('');try{const response=await fetch('/api/auth',{method:'DELETE'});if(!response.ok){const body=await response.json();throw new Error(body.error||'Unable to sign out. Please retry.');}setUser(null);setConfirmRiderSignOut(false);window.dispatchEvent(new Event('homefoods:account-change'));close();router.push('/');router.refresh();}catch(e){setError(e instanceof Error?e.message:'Unable to sign out. Please retry.');}finally{setBusy(false);}}
 const navigationHash=hash || (pathname==='/workspace'?workspaceDefaultHash(user?.role):'');
 const link=(item:NavigationItem,prominent=false)=><NavigationLink key={item.href} href={item.href} onClick={close} className={`app-nav-link${prominent?' app-nav-workspace':''}`} aria-current={isNavigationActive(item.href,pathname,navigationHash)?'page':undefined}><NavigationIcon name={item.icon}/><span>{item.label}</span>{prominent&&<NavigationIcon name="arrow"/>}</NavigationLink>;
 const workspace=user?roleDestinations[user.role]:undefined;
 return <Navigation.Provider value={{ready,open,toggle:()=>open?close():setOpen(true),trigger,user}}><div className={standalone?'app-auth-content':'app-shell'}>{!standalone&&pathname!=='/'&&<AppHeader/>}{children}</div>{!standalone&&<OverlayLayer open={open} className={`app-drawer-layer${closing?' is-closing':''}`} dialogClassName="app-drawer" dialogRef={dialog} triggerRef={trigger} onClose={close} swipeToClose="left" label="HomeFoods navigation" initialFocusSelector=".app-drawer-close" dismissOnBackdrop>
 <div className="app-drawer-top"><span className="app-drawer-wordmark">At home with HomeFoods</span><button type="button" className="app-drawer-close" aria-label="Close navigation" onClick={close}><NavigationIcon name="close"/></button></div>
 {user?<NavigationLink className="app-drawer-profile" href={accountHref} onClick={close} aria-current={isNavigationActive(accountHref,pathname,navigationHash)?'page':undefined}><Avatar user={user}/><span><strong>{user.name||user.email}</strong><small>{user.email}</small><small className="app-role">{roleLabels[user.role]}</small><span className="app-manage">Manage Account <NavigationIcon name="arrow"/></span></span></NavigationLink>:<div className="app-guest"><h2>A seat at the table.</h2><p>Good food. Your favourite people.</p><div className="app-guest-actions"><Link href="/signin" onClick={close}>Sign in <NavigationIcon name="arrow"/></Link><Link href="/join" className="app-join" onClick={close}>Join</Link></div></div>}
 {workspace&&link(workspace,true)}
 <nav aria-label="Main navigation"><div className="app-nav-group"><h2>Discover</h2>{discoveryNavigation.map(i=>link(i))}</div>{user&&<><div className="app-nav-group"><h2>Your Home Foods</h2>{personalNavigation(user.role).map(i=>link(i))}</div><div className="app-nav-group"><h2>Account</h2>{accountNavigation.map(i=>link(i))}</div></>}{!user&&<div className="app-nav-group"><h2>Join our table</h2>{link({label:'Become a cook',href:'/join?role=SELLER',icon:'kitchen'})}{link({label:'Deliver with us',href:'/join?role=RIDER',icon:'delivery'})}</div>}</nav>
 <div className="app-drawer-footer">{confirmRiderSignOut&&<p className="app-logout-note">Signing out takes you offline. Assigned deliveries remain attached to your account so they can be resumed or recovered by an administrator.<button type="button" onClick={()=>setConfirmRiderSignOut(false)}>Stay signed in</button></p>}{error&&<p role="alert">{error}</p>}{user&&<button className="app-nav-link app-signout" disabled={busy} onClick={()=>user.role==='RIDER'&&!confirmRiderSignOut?setConfirmRiderSignOut(true):void signOut()}><NavigationIcon name="arrow"/>{busy?'Signing out…':confirmRiderSignOut?'Confirm Sign Out':'Sign Out'}</button>}<div className="sidebar-bottom"><span className="app-brand-note">Made with care, right around the corner.</span><ThemeToggle/><NavigationLink href="/#faq" onClick={close}>Help & FAQs</NavigationLink></div></div>
 </OverlayLayer>}</Navigation.Provider>;
}
