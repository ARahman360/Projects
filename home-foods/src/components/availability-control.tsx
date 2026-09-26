"use client";

import { useRef, useState, type PointerEvent } from "react";

/** Both presentations request the same explicit server state; dragging never changes it locally. */
export default function AvailabilityControl({ online, disabled, onChange }: {
  online: boolean; disabled?: boolean; onChange: (online: boolean) => Promise<boolean>;
}) {
  const [saving, setSaving] = useState(false);
  const [distance, setDistance] = useState(0);
  const [message, setMessage] = useState("");
  const track = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: number; x: number; y: number; max: number; dx: number; online: boolean } | null>(null);
  const inFlight = useRef(false);
  const action = online ? "Go Offline" : "Go Online";
  async function change() {
    if (disabled || inFlight.current) return;
    inFlight.current = true; setSaving(true); setMessage(""); setDistance(0);
    try { setMessage(await onChange(!online) ? `Availability saved: ${online ? "offline" : "online"}.` : "Availability was not changed. Check the error and try again."); }
    catch { setMessage("Unable to save availability. Please retry."); }
    finally { inFlight.current = false; setSaving(false); }
  }
  function start(e: PointerEvent<HTMLButtonElement>) {
    if (disabled || saving || !e.isPrimary || e.button !== 0) return;
    gesture.current = { id:e.pointerId, x:e.clientX, y:e.clientY, max:Math.max(1,(track.current?.clientWidth ?? 300)-64), dx:0, online };
    e.currentTarget.setPointerCapture(e.pointerId); setMessage("");
  }
  function move(e: PointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    if (Math.abs(e.clientY-g.y)>18 && Math.abs(e.clientY-g.y)>Math.abs(e.clientX-g.x)) { gesture.current=null; setDistance(0); return; }
    g.dx=Math.min(g.max,Math.max(0,e.clientX-g.x)); setDistance(g.dx);
  }
  function finish(e: PointerEvent<HTMLButtonElement>) {
    const g=gesture.current; gesture.current=null; setDistance(0);
    if (g && g.id===e.pointerId && g.online===online && g.dx/g.max>=.85) void change();
  }
  return <div className="availability-control" data-online={online} aria-busy={saving}>
    <button type="button" className="availability-desktop" disabled={disabled || saving} onClick={() => void change()}>{saving ? "Saving…" : action}</button>
    <div className="availability-mobile">
      <div className="availability-track" ref={track} data-disabled={disabled || saving}>
        <span aria-hidden="true">{saving ? "Saving availability…" : `Slide to ${action}`}</span>
        <button type="button" className="availability-handle" aria-label={action} disabled={disabled || saving} style={{transform:`translateX(${distance}px)`}} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={() => {gesture.current=null;setDistance(0);}} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();void change();}}}><span aria-hidden="true">→</span></button>
      </div>
      <button type="button" className="availability-alternative" disabled={disabled || saving} onClick={() => void change()}>{action} without sliding</button>
    </div>
    <small role="status" className="availability-feedback">{message}</small>
  </div>;
}
