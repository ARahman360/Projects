"use client";
import { useEffect, useRef, useState } from "react";
import OverlayLayer from "./overlay-layer";
import AddressEditor, { addressRequest, type SavedAddress } from "./address-editor";
export type DeliveryLocation = { label: string; latitude?: number; longitude?: number; countryCode?: string; addressId?: number; address?: SavedAddress; ownerId?: number | null; invalidated?: boolean };
export function deliveryLocation(address: SavedAddress, ownerId: number | null): DeliveryLocation {
  return { label: `${address.label ? `${address.label} · ` : ""}${address.addressLine1}, ${address.city}`, latitude: address.latitude ?? undefined, longitude: address.longitude ?? undefined, countryCode: address.countryCode ?? undefined, addressId: address.id, address, ownerId };
}
export function selectLocation(address: SavedAddress, ownerId: number | null) {
  const next = deliveryLocation(address, ownerId);
  localStorage.setItem(`home-foods-location:${ownerId ?? "guest"}`, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("homefoods:location-change", { detail: next }));
  return next;
}
export default function LocationSelector({ onSelect, triggerLabel }: { onSelect?: (location: DeliveryLocation, address?: SavedAddress) => void; triggerLabel?: string }) {
  const [loaded,setLoaded] = useState(false);
  const [open,setOpen] = useState(false), [addresses,setAddresses] = useState<SavedAddress[]>([]), [owner,setOwner] = useState<number|null>(null);
  const [location,setLocation] = useState<DeliveryLocation>({label:"Choose a location"});
  const [error,setError] = useState(""), [busy,setBusy] = useState(false), [editing,setEditing] = useState(false);
  const dialog = useRef<HTMLElement|null>(null), trigger = useRef<HTMLButtonElement|null>(null), request = useRef(0);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const generation = ++request.current;
      setLoaded(false);
      try {
        const auth = await addressRequest("/api/auth");
        const id = auth.user?.role === "CUSTOMER" ? auth.user.id as number : null;
        const result = id !== null ? await addressRequest("/api/addresses") : { addresses: [] };
        if (!active || generation !== request.current) return;
        setOwner(id); setAddresses(result.addresses); setLoaded(true); setError("");
        let stored: DeliveryLocation | null = null;
        try { stored = JSON.parse(localStorage.getItem(`home-foods-location:${id ?? "guest"}`) ?? "null"); } catch {}
        const existing = result.addresses.find((a:SavedAddress)=>a.id===stored?.addressId);
        const invalidated = Boolean(stored?.invalidated || (stored?.addressId && !existing));
        const selected = existing ?? (invalidated ? undefined : result.addresses.find((a:SavedAddress)=>a.isDefault) ?? result.addresses[0]);
        const next = selected ? deliveryLocation(selected,id) : id === null && stored ? stored : { label:"Choose a location",ownerId:id,invalidated };
        setLocation(next);
        localStorage.setItem(`home-foods-location:${id ?? "guest"}`,JSON.stringify(next));
        window.dispatchEvent(new CustomEvent("homefoods:location-change",{detail:next}));
      } catch { if (active && generation === request.current) { setLoaded(true); setError("Saved addresses couldn't be refreshed. Please try again."); } }
    };
    const changed = (e:Event) => { const value=(e as CustomEvent<DeliveryLocation>).detail; if(value) setLocation(value); };
    const storage = (e:StorageEvent) => { if(e.key==="homefoods:addresses-updated") void refresh(); };
    void refresh();
    window.addEventListener("homefoods:account-change",refresh);window.addEventListener("homefoods:addresses-change",refresh);window.addEventListener("homefoods:location-change",changed);window.addEventListener("storage",storage);
    return ()=>{active=false;window.removeEventListener("homefoods:account-change",refresh);window.removeEventListener("homefoods:addresses-change",refresh);window.removeEventListener("homefoods:location-change",changed);window.removeEventListener("storage",storage);};
  },[]);
  function choose(address:SavedAddress) { const next=selectLocation(address,owner);setLocation(next);setOpen(false);setError("");onSelect?.(next,address); }
  async function chooseSaved(address:SavedAddress) {
    setBusy(true);setError("");
    try { const verified = await addressRequest("/api/location/resolve",{addressId:address.id});choose({...address,latitude:verified.latitude,longitude:verified.longitude,countryCode:verified.countryCode,status:verified.sandbox?"sandbox":"verified"}); }
    catch(e){setError(e instanceof Error?e.message:"Choose another address.");}finally{setBusy(false);}
  }
  return <>
    <button ref={trigger} className={triggerLabel?"address-picker-trigger":"delivery-indicator location-trigger"} type="button" onClick={()=>{setOpen(true);setEditing(false);setError("");}} aria-haspopup="dialog" aria-expanded={open} aria-label={triggerLabel || `Change delivery address. Current address: ${location.label}`}>
      <svg className="delivery-pin" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.3"/></svg><span><small>DELIVER TO</small><b>{triggerLabel || location.label}</b></span><span className="delivery-chevron">⌄</span>
    </button>
    <OverlayLayer open={open} className="modal-backdrop location-backdrop" dialogClassName="location-modal address-dialog" dialogRef={dialog} triggerRef={trigger} label="Choose delivery address" onClose={()=>setOpen(false)} dismissOnBackdrop>
      <button className="close-button modal-close" type="button" onClick={()=>setOpen(false)} aria-label="Close location selector">×</button>
      <div className="eyebrow">A LITTLE CLOSER TO HOME</div><h2>Where should we <em>deliver?</em></h2>
      <p>Choose a saved address or find your door in Finland.</p>
      {!loaded && <p role="status">Loading your saved addresses…</p>}
      {loaded && !editing && addresses.length>0 && <div className="address-choice-list">{addresses.map(a=><button type="button" key={a.id} disabled={busy} onClick={()=>void chooseSaved(a)}><b>{a.label||"Delivery address"}{a.isDefault?" · Default":""}</b><span>{a.addressLine1}{a.addressLine2?`, ${a.addressLine2}`:""}</span><small>{a.postalCode} {a.city} · {a.status==="verified"?"Verified":a.status==="sandbox"?"Sandbox only":"Needs verification"}</small></button>)}<button type="button" onClick={()=>setEditing(true)}>+ Add a new address</button></div>}
      {loaded && (editing || !addresses.length) && <AddressEditor saveToAccount={owner!==null} onSaved={choose} onCancel={addresses.length?()=>setEditing(false):undefined}/>}
      {busy && <p role="status">Checking your saved address…</p>}{error && <p className="form-error" role="alert">{error}</p>}
    </OverlayLayer>
  </>;
}
