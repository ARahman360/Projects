"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import LeafletAddressMap from "@/src/components/leaflet-address-map";

type VerifiedLocation = { formattedAddress: string; addressLine1: string; city: string; postalCode: string; countryCode: "FI"; latitude: number; longitude: number; accuracy?: number; deliverable: boolean; nearbyKitchens: number; nearestKitchenKm: number | null };
type DeliveryLocation = { label: string; latitude?: number; longitude?: number; countryCode?: string };
type SavedAddress = { id?: number; label?: string | null; addressLine1: string; addressLine2?: string | null; city: string; postalCode?: string | null; isDefault?: boolean; latitude?: number | null; longitude?: number | null };
type Suggestion = { placeId: string; text: string };
const locationKey = (ownerId: number | null) => `home-foods-location:${ownerId === null ? "guest" : ownerId}`;

function LocationSuggestionText({ text, query }: { text: string; query: string }) {
  const start = text.toLocaleLowerCase().indexOf(query.trim().toLocaleLowerCase());
  if (start < 0 || !query.trim()) return text;
  return <>{text.slice(0, start)}<strong>{text.slice(start, start + query.trim().length)}</strong>{text.slice(start + query.trim().length)}</>;
}

export default function LocationSelector({ onSelect }: { onSelect?: (location: DeliveryLocation, address?: SavedAddress) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [line, setLine] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [location, setLocation] = useState<DeliveryLocation>({ label: "Choose a location" });
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [isCustomer, setIsCustomer] = useState(false);
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionQuery, setSuggestionQuery] = useState("");
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [pending, setPending] = useState<VerifiedLocation | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [setupMessage, setSetupMessage] = useState("");
  const [geoapifyConfigured, setGeoapifyConfigured] = useState<boolean | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [mapPoint, setMapPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const suggestionTimer = useRef<number | null>(null);
  const requestId = useRef(0);

  async function refreshAddresses() {
    try {
      const authResponse = await fetch("/api/auth", { cache: "no-store" });
      const auth = await authResponse.json();
      const customer = auth.user?.role === "CUSTOMER";
      const id = customer ? Number(auth.user.id) : null;
      setIsCustomer(customer);
      setOwnerId(Number.isInteger(id) ? id : null);
      if (customer) {
        const response = await fetch("/api/addresses", { cache: "no-store" });
        const data = await response.json();
        const savedAddresses = (data.addresses ?? []) as SavedAddress[];
        setAddresses(savedAddresses);
        const preferred = savedAddresses.find((address) => address.isDefault) ?? savedAddresses[0];
        if (preferred) {
          const next = { label: `${preferred.label ? `${preferred.label} · ` : ""}${preferred.addressLine1}, ${preferred.city}`, latitude: preferred.latitude ?? undefined, longitude: preferred.longitude ?? undefined, countryCode: "FI" };
          setLocation(next);
          window.localStorage.setItem(locationKey(id), JSON.stringify(next));
          window.dispatchEvent(new CustomEvent("homefoods:location-change", { detail: next }));
          return;
        }
      } else setAddresses([]);
      const saved = window.localStorage.getItem(locationKey(Number.isInteger(id) ? id : null)) ?? (!customer ? window.localStorage.getItem("home-foods-location") : null);
      const next = saved ? JSON.parse(saved) as DeliveryLocation : { label: "Choose a location" };
      setLocation(next);
      window.dispatchEvent(new CustomEvent("homefoods:location-change", { detail: next }));
    } catch { /* Location entry remains available if account lookups are temporarily unavailable. */ }
  }

  useEffect(() => {
    queueMicrotask(() => void refreshAddresses());
    window.addEventListener("homefoods:account-change", refreshAddresses);
    return () => { window.removeEventListener("homefoods:account-change", refreshAddresses); if (suggestionTimer.current) window.clearTimeout(suggestionTimer.current); };
  }, []);

  useEffect(() => {
    const request = ++requestId.current;
    const controller = new AbortController();
    if (suggestionTimer.current) window.clearTimeout(suggestionTimer.current);
    if (!open || query.trim().length < 3) return;
    suggestionTimer.current = window.setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          const response = await fetch(`/api/location/suggest?q=${encodeURIComponent(query.trim())}`, { cache: "no-store", signal: controller.signal });
          const result = await response.json() as { suggestions?: Array<{ text: string }>; error?: string };
          if (!response.ok) throw new Error(result.error ?? "Address suggestions are temporarily unavailable.");
          if (request !== requestId.current) return;
          setSuggestions((result.suggestions ?? []).map((entry, index) => ({ placeId: `${query.trim()}-${index}`, text: entry.text })));
          setSuggestionQuery(query.trim());
          setActiveSuggestion(-1);
          setError("");
        } catch (issue) {
          if (request === requestId.current && !(issue instanceof DOMException && issue.name === "AbortError")) { setSuggestions([]); setError(issue instanceof Error ? issue.message : "Address search is unavailable."); }
        } finally {
          if (request === requestId.current) setSearching(false);
        }
      })();
    }, 350);
    return () => { if (suggestionTimer.current) window.clearTimeout(suggestionTimer.current); controller.abort(); };
  }, [open, query]);

  function choose(next: DeliveryLocation, address?: SavedAddress) {
    setLocation(next);
    window.localStorage.setItem(locationKey(ownerId), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("homefoods:location-change", { detail: next }));
    setOpen(false); setError(""); setPending(null); setQuery(""); setSuggestions([]); setSearching(false);
    onSelect?.(next, address);
  }

  async function resolveLocation(body: Record<string, unknown>) {
    const response = await fetch("/api/location/resolve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
    const result = await response.json() as VerifiedLocation & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "We couldn't verify this delivery address.");
    return result;
  }

  async function confirmLocation(verified: VerifiedLocation) {
    setBusy(true); setError("");
    try {
      const label = `${verified.addressLine1}, ${verified.city}`;
      let savedAddress: SavedAddress = { addressLine1: verified.addressLine1, addressLine2: addressLine2.trim() || null, city: verified.city, postalCode: verified.postalCode || null, latitude: verified.latitude, longitude: verified.longitude, label: "Delivery" };
      if (isCustomer) {
        const response = await fetch("/api/addresses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...savedAddress }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Couldn't save the verified address.");
        savedAddress = result.address as SavedAddress;
        setAddresses((current) => [savedAddress, ...current.filter((address) => address.id !== savedAddress.id)]);
      }
      choose({ label: `${savedAddress.label ? `${savedAddress.label} · ` : ""}${label}${addressLine2.trim() ? `, ${addressLine2.trim()}` : ""}`, latitude: verified.latitude, longitude: verified.longitude, countryCode: "FI" }, savedAddress);
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Couldn't save the verified address."); }
    finally { setBusy(false); }
  }

  async function selectPlace(suggestion: Suggestion) {
    setBusy(true); setError(""); setSuggestions([]);
    try {
      const verified = await resolveLocation({ addressText: suggestion.text });
      setPending(verified); setLine(verified.addressLine1); setCity(verified.city); setPostalCode(verified.postalCode); setAccuracy(verified.accuracy ?? null); setQuery(verified.formattedAddress);
    } catch (issue) { setError(issue instanceof Error ? issue.message : "We couldn't verify that address."); }
    finally { setBusy(false); }
  }

  async function requestCurrentLocation() {
    if (!navigator.geolocation) { setError("Location is not available in this browser. Enter a Finnish address instead."); return; }
    setBusy(true); setError(""); setPending(null);
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const verified = await resolveLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setPending(verified); setLine(verified.addressLine1); setCity(verified.city); setPostalCode(verified.postalCode); setAccuracy(position.coords.accuracy);
      } catch (issue) { setError(issue instanceof Error ? issue.message : "We couldn't verify your current location."); }
      finally { setBusy(false); }
    }, (issue) => {
      setError(issue.code === issue.PERMISSION_DENIED ? "Location permission was denied. Allow access in your browser settings, or search for a Finnish address." : issue.code === issue.TIMEOUT ? "Your browser did not return a location in time. Turn on device location services and try again, or search for your Finnish address." : "We couldn't get your location. Check your browser and device location settings, or search for an address.");
      setBusy(false);
    // A coarse first fix is usually much faster on laptops and desktops, where
    // high-accuracy GPS hardware is often unavailable. The customer sees the
    // reported accuracy and confirms or adjusts the resolved street address.
    }, { enableHighAccuracy: false, timeout: 30000, maximumAge: 120000 });
  }

  async function chooseSavedAddress(address: SavedAddress) {
    setBusy(true); setError("");
    try {
      const verified = await resolveLocation({ addressId: address.id });
      setLine(verified.addressLine1); setCity(verified.city); setPostalCode(verified.postalCode); setAddressLine2(address.addressLine2 ?? "");
      choose({ label: `${address.label ? `${address.label} · ` : ""}${verified.addressLine1}, ${verified.city}`, latitude: verified.latitude, longitude: verified.longitude, countryCode: "FI" }, { ...address, ...verified });
    } catch (issue) { setError(issue instanceof Error ? issue.message : "We couldn't verify that saved address."); }
    finally { setBusy(false); }
  }

  async function handleEnteredAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setPending(null);
    try {
      const verified = await resolveLocation({ addressText: `${line.trim()}, ${postalCode.trim()} ${city.trim()}, Finland` });
      setPending(verified); setLine(verified.addressLine1); setCity(verified.city); setPostalCode(verified.postalCode); setAccuracy(verified.accuracy ?? null);
    } catch (issue) { setError(issue instanceof Error ? issue.message : "We couldn't verify that address."); }
    finally { setBusy(false); }
  }

  async function verifyMapPoint() {
    if (!mapPoint) return;
    setBusy(true); setError("");
    try {
      const verified = await resolveLocation(mapPoint);
      setPending(verified); setLine(verified.addressLine1); setCity(verified.city); setPostalCode(verified.postalCode); setAccuracy(null);
    } catch (issue) { setError(issue instanceof Error ? issue.message : "The map point could not be verified."); }
    finally { setBusy(false); }
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { setSuggestions([]); setOpen(false); }
    if (event.key === "ArrowDown" && suggestions.length) { event.preventDefault(); setActiveSuggestion((active) => Math.min(active + 1, suggestions.length - 1)); }
    if (event.key === "ArrowUp" && suggestions.length) { event.preventDefault(); setActiveSuggestion((active) => Math.max(active - 1, 0)); }
    if (event.key === "Enter" && activeSuggestion >= 0 && suggestions[activeSuggestion]) { event.preventDefault(); void selectPlace(suggestions[activeSuggestion]); }
  }

  function openModal() {
    setOpen(true); setError(""); setPending(null); setSetupMessage("");
    void fetch("/api/location/resolve", { cache: "no-store" }).then((response) => response.json()).then((configuration: { geoapifyConfigured: boolean; maximumDeliveryDistanceKm: number }) => {
      setGeoapifyConfigured(configuration.geoapifyConfigured);
      if (!configuration.geoapifyConfigured) setSetupMessage("Set GEOAPIFY_API_KEY in .env.local and restart the development server to enable Finnish address search, reverse geocoding and road distance checks.");
      else setSetupMessage(`Finnish address lookup is connected. Delivery distance is checked after you choose an address, up to ${configuration.maximumDeliveryDistanceKm} km by road.`);
    }).catch(() => setSetupMessage("Location configuration is unavailable. Please try again."));
    void refreshAddresses();
  }

  return <>
    <button className="delivery-indicator location-trigger" type="button" onClick={openModal} aria-haspopup="dialog" aria-expanded={open}>
      <svg className="delivery-pin" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.3"/></svg>
      <span><small>DELIVER TO</small><b>{location.label}</b></span><span className="delivery-chevron">⌄</span>
    </button>
    {open && <div className="modal-backdrop location-backdrop" onClick={() => { if (!busy) setOpen(false); }}><section className="location-modal" role="dialog" aria-modal="true" aria-labelledby="location-title" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape" && !busy) setOpen(false); }}>
      <button className="close-button modal-close" type="button" onClick={() => { setOpen(false); setSearching(false); }} aria-label="Close location selector">×</button>
      <div className="eyebrow"><span className="eyebrow-line"/> DELIVERY ADDRESS · FINLAND</div>
      <h2 id="location-title">Where should we <em>deliver?</em></h2>
      <p className="location-explainer">Choose a saved address, detect your location, or search for an address in Finland. We verify the address and show whether delivery is available there.</p>
      {addresses.length > 0 && <div className="saved-location-list"><strong>Saved addresses</strong>{addresses.map((address, index) => <button key={address.id ?? `${address.addressLine1}-${index}`} type="button" disabled={busy} onClick={() => void chooseSavedAddress(address)}><span>⌖</span><span><b>{address.label || address.addressLine1}</b><small>{address.addressLine1}, {address.city}{address.postalCode ? ` ${address.postalCode}` : ""}</small></span><i>→</i></button>)}</div>}
      <button className="location-current" type="button" onClick={() => void requestCurrentLocation()} disabled={busy || geoapifyConfigured === false}><span>◎</span>{busy ? "Verifying location…" : "Use my current location"}<small>We only check your location when you ask us to.</small></button>
      <div className="location-divider"><span>OR SEARCH AN ADDRESS</span></div>
      {setupMessage && <p className="location-setup-note" role="status">{setupMessage}</p>}
      <p className="location-provider-credit">Address data by Geoapify · OpenStreetMap contributors</p>
      <button className="location-map-toggle" type="button" onClick={() => setShowMap((shown) => !shown)} aria-expanded={showMap}>{showMap ? "Hide map" : "Choose on map"}</button>
      {showMap && <div className="location-map-panel"><LeafletAddressMap center={location.latitude !== undefined && location.longitude !== undefined ? { latitude: location.latitude, longitude: location.longitude } : undefined} onPick={setMapPoint}/><p>Click the map to place a pin, then verify the address.</p><button className="checkout-button" type="button" onClick={() => void verifyMapPoint()} disabled={!mapPoint || busy || geoapifyConfigured !== true}>Verify map pin <span>→</span></button></div>}
      {!pending ? <form className="location-form" onSubmit={(event) => void handleEnteredAddress(event)}>
        <label>Search a Finnish address<div className="location-search-field"><input value={query} onChange={(event) => { setQuery(event.target.value); setPending(null); setError(""); setSearching(false); }} onKeyDown={onSearchKeyDown} placeholder="Street, building number, city" autoComplete="off" role="combobox" aria-expanded={suggestions.length > 0} aria-controls="homefoods-address-suggestions" aria-activedescendant={activeSuggestion >= 0 ? `location-suggestion-${activeSuggestion}` : undefined}/>{query && <button type="button" aria-label="Clear address search" onClick={() => { setQuery(""); setSuggestions([]); setPending(null); setSearching(false); }}>×</button>}</div></label>
        {searching && <p className="location-search-status" role="status">Searching Finnish addresses…</p>}
        {suggestionQuery === query.trim() && suggestions.length > 0 && <><div className="location-suggestions" id="homefoods-address-suggestions" role="listbox" aria-label="Finnish address suggestions">{suggestions.map((suggestion, index) => <button id={`location-suggestion-${index}`} role="option" aria-selected={activeSuggestion === index} type="button" key={suggestion.placeId} onMouseEnter={() => setActiveSuggestion(index)} onClick={() => void selectPlace(suggestion)}><LocationSuggestionText text={suggestion.text} query={query}/></button>)}</div><div className="google-attribution" aria-label="Geoapify address data based on OpenStreetMap"><span>Powered by Geoapify · © OpenStreetMap contributors</span></div></>}
        {!searching && suggestionQuery === query.trim() && query.trim().length >= 3 && !suggestions.length && !error && <p className="location-search-status">No Finnish addresses found. Add the building number or postal code and try again.</p>}
        <div className="location-address-fields"><label>Street address<input value={line} onChange={(event) => setLine(event.target.value)} placeholder="Street and house number" autoComplete="street-address" required/></label><label>Postal code<input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} placeholder="Postal code" autoComplete="postal-code" required/></label><label>City or town<input value={city} onChange={(event) => setCity(event.target.value)} placeholder="City" autoComplete="address-level2" required/></label></div>
        <button className="checkout-button" type="submit" disabled={busy || geoapifyConfigured === false}>{busy ? "Checking address…" : "Verify this address"}<span>→</span></button>
      </form> : <div className="location-confirm"><span className="location-verified-mark">✓</span><b>{pending.deliverable ? "Verified delivery address" : "Verified Finnish address · delivery unavailable here"}</b><p>{pending.formattedAddress}</p><small>{pending.nearbyKitchens} kitchen{pending.nearbyKitchens === 1 ? "" : "s"} serve this location{pending.nearestKitchenKm != null ? ` · nearest ${pending.nearestKitchenKm.toFixed(1)} km away` : ""}.</small>{accuracy != null && <small>Location accuracy is approximately {accuracy >= 1000 ? `${(accuracy / 1000).toFixed(1)} km` : `${Math.round(accuracy)} m`}; adjust the address if needed.</small>}<label>Apartment, floor, entrance or delivery instructions <input value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} placeholder="Optional" autoComplete="address-line2"/></label><button className="checkout-button" type="button" onClick={() => void confirmLocation(pending)} disabled={busy}>{busy ? "Saving address…" : "Confirm and use this address"}<span>→</span></button><button className="location-edit" type="button" onClick={() => setPending(null)}>Change address</button></div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {busy && <p className="location-loading" role="status" aria-live="polite"><span/>Checking with HomeFoods…</p>}
    </section></div>}
  </>;
}
