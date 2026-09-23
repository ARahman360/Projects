"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import Brand from "@/src/components/brand";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (password !== confirmation) { setError("Those passwords don’t match."); return; }
    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    setBusy(true);
    try {
      const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "This reset link is invalid or has expired.");
      setSuccess(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Password reset is temporarily unavailable."); }
    finally { setBusy(false); }
  }

  return <main className="reset-page" id="main-content"><header><Link className="reset-back" href="/">← Back to Home</Link><Brand href="/"/></header><section className="reset-card"><span className="eyebrow"><span className="eyebrow-line"/> ACCOUNT RECOVERY</span><h1>{success ? <>You’re back <em>in control.</em></> : <>Choose a new <em>password.</em></>}</h1>{success ? <><p>Your password has been updated. Sign in with the new password to continue.</p><Link className="checkout-button reset-cta" href="/signin">Sign in to HomeFoods <span>→</span></Link></> : <form className="checkout-form" onSubmit={submit}><p className="checkout-summary">Use at least 10 characters. The link can only be used once.</p><label>New password<input type="password" autoComplete="new-password" minLength={10} maxLength={200} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 10 characters"/></label><label>Confirm new password<input type="password" autoComplete="new-password" minLength={10} maxLength={200} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Enter it again"/></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="checkout-button" disabled={busy}>{busy ? "Updating…" : "Update password"}<span>→</span></button><Link className="reset-back" href="/signin">← Back to sign in</Link></form>}</section></main>;
}
