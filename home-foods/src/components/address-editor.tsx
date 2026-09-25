"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import LeafletAddressMap from "./leaflet-address-map";

export type SavedAddress = { id?: number; label?: string | null; addressLine1: string; addressLine2?: string | null; city: string; postalCode?: string | null; countryCode?: string | null; latitude?: number | null; longitude?: number | null; isDefault?: boolean; status?: string; verificationSource?: string | null; verificationToken?: string };
type Suggestion = { text: string; location: SavedAddress & { houseNumber?: string }; verificationToken: string };
export function addressChanged() { window.dispatchEvent(new Event("homefoods:addresses-change")); localStorage.setItem("homefoods:addresses-updated", String(Date.now())); }
export async function addressRequest(path: string, body?: unknown, method = "POST") {
  const response = await fetch(path, { method: body ? method : "GET", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, cache: "no-store", signal: AbortSignal.timeout(20000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Address service is unavailable. Please try again.");
  return result;
}
export default function AddressEditor({ initial, saveToAccount = true, onSaved, onCancel }: { initial?: SavedAddress; saveToAccount?: boolean; onSaved: (address: SavedAddress) => void; onCancel?: () => void }) {
  const [fields, setFields] = useState<SavedAddress>(initial ?? { label: "Home", addressLine1: "", addressLine2: "", city: "", postalCode: "", countryCode: "FI" });
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [token, setToken] = useState("");
  const [sandboxAvailable, setSandboxAvailable] = useState(false);
  const [sandbox, setSandbox] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [point, setPoint] = useState<{latitude:number;longitude:number} | null>(null);
  const searchBox = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  const generation = useRef(0);
  const listId = useId();
  useEffect(() => {
    alive.current = true;
    void addressRequest("/api/location/resolve").then(c => { if (alive.current) setSandboxAvailable(c.sandboxAddressFallback); }).catch(() => {});
    const outside = (e: PointerEvent) => { if (!searchBox.current?.contains(e.target as Node)) setExpanded(false); };
    document.addEventListener("pointerdown", outside);
    return () => { alive.current = false; document.removeEventListener("pointerdown", outside); };
  }, []);
  useEffect(() => {
    if (query.trim().length < 3) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/location/suggest?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (!controller.signal.aborted) { setSuggestions(result.suggestions ?? []); setExpanded(true); setSearched(true); setActive(-1); }
      } catch (e) { if (!controller.signal.aborted) { setSuggestions([]); setError(e instanceof Error ? e.message : "Address search is unavailable."); } }
      finally { if (!controller.signal.aborted) setSearching(false); }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  function change(key: keyof SavedAddress, value: string) {
    generation.current++;
    setBusy("");
    setFields(f => ({ ...f, [key]: value })); setError(""); setNote("");
    if (["addressLine1", "city", "postalCode"].includes(key)) setToken("");
  }
  function pick(s: Suggestion) {
    generation.current++;
    setBusy("");
    setFields(f => ({ ...f, ...s.location, id: initial?.id, label: f.label, addressLine2: f.addressLine2 }));
    setToken(s.verificationToken); setQuery(""); setSuggestions([]); setExpanded(false); setSearching(false); setError(""); setSandbox(false);
    setNote(s.location.houseNumber ? "Address selected. Confirm the details below, including your apartment or entrance." : "Street selected. Add the building number below, then confirm the address.");
  }
  async function reverse(latitude: number, longitude: number, accuracy?: number) {
    const current = ++generation.current;
    setBusy("Finding the nearest address…"); setError("");
    try {
      const result = await addressRequest("/api/location/resolve", { latitude, longitude, candidateOnly: true });
      if (!alive.current || current !== generation.current) return;
      setFields(f => ({ ...f, ...result, id: initial?.id, label: f.label, addressLine2: f.addressLine2 })); setToken(result.verificationToken); setSandbox(false);
      setNote(`Please confirm or correct this nearby address.${accuracy != null ? ` Browser accuracy: approximately ${Math.round(accuracy)} metres.` : ""} Location detection may not identify your exact door.`);
    } catch(e) { if (alive.current && current === generation.current) setError(e instanceof Error ? e.message : "Couldn't find this address."); }
    finally { if (alive.current && current === generation.current) setBusy(""); }
  }
  function locate() {
    if (!window.isSecureContext) { setError("Location access requires HTTPS or localhost. Search for your address instead."); return; }
    if (!navigator.geolocation) { setError("This browser does not support location access. Search for your address instead."); return; }
    setBusy("Waiting for your device location…"); setError("");
    const current = ++generation.current;
    navigator.geolocation.getCurrentPosition(p => { if (alive.current && current === generation.current) void reverse(p.coords.latitude, p.coords.longitude, p.coords.accuracy); }, e => {
      if (!alive.current || current !== generation.current) return;
      setBusy(""); setError(e.code === 1 ? "Location permission was denied. Allow it in your browser settings or search for an address." : e.code === 3 ? "Location detection timed out. Check device location services or search for an address." : "Your device couldn't provide a location. Search for your Finnish address.");
    }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 });
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy("Saving address…"); setError("");
    try {
      if (saveToAccount) {
        const result = await addressRequest("/api/addresses", { ...fields, id: initial?.id, verificationToken: token, sandboxConfirmation: sandbox }, initial?.id ? "PATCH" : "POST");
        addressChanged(); onSaved(result.address);
      } else {
        const result = await addressRequest("/api/location/resolve", token ? { verificationToken: token, candidateOnly: true } : { addressText: `${fields.addressLine1}, ${fields.postalCode} ${fields.city}, Finland`, candidateOnly: true });
        if (!result.houseNumber || !/^\d{5}$/.test(result.postalCode)) throw new Error("Add the building number and five-digit postal code, then confirm your address.");
        onSaved({ ...fields, ...result, addressLine2: fields.addressLine2, status: "verified" });
      }
    } catch(e) { setError(e instanceof Error ? e.message : "Couldn't save this address."); }
    finally { if (alive.current) setBusy(""); }
  }
  return <div className="address-editor">
    <button type="button" className="address-gps" disabled={!!busy} onClick={locate}><span aria-hidden="true">◎</span><span>Use my current location<small>Find a nearby address, then confirm your door.</small></span></button>
    <div className="address-search" ref={searchBox}>
      <label htmlFor={`${listId}-search`}>Search a Finnish address</label>
      <div className="address-search-input"><input id={`${listId}-search`} role="combobox" aria-autocomplete="list" aria-expanded={expanded && !!suggestions.length} aria-controls={listId} aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined} autoComplete="off" placeholder="Start typing a street or city…" value={query} onChange={e => { generation.current++; setQuery(e.target.value); setSuggestions([]); setSearched(false); setSearching(false); setError(""); setExpanded(true); setActive(-1); }} onFocus={() => setExpanded(true)} onKeyDown={e => {
        if (e.key === "Escape" && expanded) { e.preventDefault(); e.stopPropagation(); setExpanded(false); }
        if (["ArrowDown", "ArrowUp"].includes(e.key) && suggestions.length) { e.preventDefault(); setExpanded(true); setActive(a => e.key === "ArrowDown" ? Math.min(a+1,suggestions.length-1) : Math.max(a-1,0)); }
        if (e.key === "Enter" && expanded && active >= 0) { e.preventDefault(); pick(suggestions[active]); }
      }}/>{query && <button type="button" aria-label="Clear address search" onClick={() => { setQuery(""); setSuggestions([]); setExpanded(false); setSearching(false); setError(""); }}>×</button>}</div>
      {searching && <p role="status">Searching Finland…</p>}
      {expanded && suggestions.length > 0 && <div className="address-options" role="listbox" id={listId}>{suggestions.map((s,i) => <button id={`${listId}-${i}`} role="option" aria-selected={active === i} type="button" key={`${s.text}-${i}`} onMouseEnter={() => setActive(i)} onClick={() => pick(s)}>{s.text}</button>)}</div>}
      {searched && query.length >= 3 && !searching && !suggestions.length && !error && <p>No matching addresses yet. Try adding your city or building number.</p>}
    </div>
    <p className="address-credit">Address data: Geoapify · © OpenStreetMap contributors</p>
    <button type="button" className="address-text-action" onClick={() => setShowMap(v=>!v)}>{showMap ? "Hide map" : "Choose on a map"}</button>
    {showMap && <div><LeafletAddressMap onPick={setPoint}/><button type="button" disabled={!point || !!busy} onClick={() => point && void reverse(point.latitude,point.longitude)}>Use this map pin</button></div>}
    {note && <p className="address-note" role="status">{note}</p>}
    <form className="address-fields" onSubmit={save}>
      {saveToAccount && <label>Address label <input value={fields.label ?? ""} onChange={e=>change("label",e.target.value)} placeholder="Home, Work…" maxLength={40}/></label>}
      <label>Street and building number <input required value={fields.addressLine1} onChange={e=>change("addressLine1",e.target.value)} autoComplete="address-line1" placeholder="Street name and house number" maxLength={150}/></label>
      <label>Apartment, floor or entrance <input value={fields.addressLine2 ?? ""} onChange={e=>change("addressLine2",e.target.value)} autoComplete="address-line2" placeholder="Optional" maxLength={150}/></label>
      <div className="address-field-row"><label>Postal code <input required pattern="[0-9]{5}" title="Enter all five digits, including leading zeros" inputMode="numeric" maxLength={5} value={fields.postalCode ?? ""} onChange={e=>change("postalCode",e.target.value)} autoComplete="postal-code" placeholder="00100"/></label><label>City or municipality <input required value={fields.city} onChange={e=>change("city",e.target.value)} autoComplete="address-level2" maxLength={80}/></label></div>
      <p className="address-country">Country: Finland</p>
      {sandboxAvailable && saveToAccount && <label className="address-sandbox"><input type="checkbox" checked={sandbox} onChange={e=>{setSandbox(e.target.checked);setError("");}}/><span>Use a fictional Finnish address for sandbox testing only.<small>No geocoding, real payment, or real delivery. Only fictional test kitchens are eligible.</small></span></label>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {busy && <p role="status">{busy}</p>}
      <div className="address-actions"><button type="submit" className="checkout-button" disabled={!!busy}>{busy || (sandbox ? "Save sandbox address" : initial?.id ? "Confirm address changes" : "Confirm and save address")}</button>{onCancel && <button type="button" onClick={onCancel} disabled={!!busy}>Cancel</button>}</div>
    </form>
  </div>;
}
