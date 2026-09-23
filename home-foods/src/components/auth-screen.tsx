"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { UserRole } from "@/src/lib/auth";
import { OriginButton } from "@/src/components/ui/origin-button";

type Mode = "signin" | "join" | "recovery";
type TestAccount = { email: string; role: UserRole };

function safeReturnTo(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : null;
}

export default function AuthScreen({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"CUSTOMER" | "SELLER" | "RIDER">("CUSTOMER");
  const [shopName, setShopName] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [developmentResetUrl, setDevelopmentResetUrl] = useState("");
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [testAccounts, setTestAccounts] = useState<TestAccount[] | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    queueMicrotask(() => {
      setReturnTo(safeReturnTo(query.get("returnTo")));
      if (mode === "join") {
        const requested = query.get("role");
        if (requested === "SELLER" || requested === "RIDER") setRole(requested);
      }
    });
    if (mode === "signin" && process.env.NODE_ENV === "development") {
      void fetch("/api/dev/test-accounts", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((data) => setTestAccounts(data?.accounts ?? null)).catch(() => setTestAccounts(null));
    }
  }, [mode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(mode === "recovery" ? "/api/auth/recovery" : "/api/auth", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "recovery" ? { email } : { intent: mode === "join" ? "signup" : "login", email, password, name, role, shopName }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "We couldn’t complete that request.");
      if (mode === "recovery") { setMessage(payload.message ?? "If an account matches that email, reset instructions will be sent shortly."); setDevelopmentResetUrl(payload.developmentResetUrl ?? ""); return; }
      if (returnTo?.includes("cart=open")) {
        try {
          const guestKey = "home-foods-cart:guest";
          const customerKey = `home-foods-cart:${payload.user.id}`;
          if (!window.localStorage.getItem(customerKey)) {
            const guestCart = window.localStorage.getItem(guestKey) ?? window.localStorage.getItem("home-foods-cart");
            if (guestCart) window.localStorage.setItem(customerKey, guestCart);
          }
        } catch { /* Keep account navigation working if storage is unavailable. */ }
      }
      const destination = payload.user.role === "CUSTOMER" ? returnTo ?? "/" : "/workspace";
      router.replace(destination);
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The account service is unavailable."); }
    finally { setBusy(false); }
  }

  const isJoin = mode === "join";
  const isRecovery = mode === "recovery";
  return <main className="auth-screen" id="main-content" tabIndex={-1}>
    <div className="auth-backdrop-orb auth-orb-one" aria-hidden="true"/><div className="auth-backdrop-orb auth-orb-two" aria-hidden="true"/>
    <section className="auth-card" aria-labelledby="auth-title">
      <div className="auth-mobile-brand"><Link href="/" className="auth-wordmark" aria-label="HomeFoods home"><span className="auth-brand-mark">⌂</span><span>Home<b>Foods</b></span></Link></div>
      <div className="auth-copy"><span className="auth-kicker"><i/> A seat at the table</span>
        <h1 id="auth-title">{isRecovery ? <>Let’s get you <em>back in.</em></> : isJoin ? <>Good food starts <em>here.</em></> : <>Welcome <em>home.</em></>}</h1>
        <p>{isRecovery ? "We’ll send a secure reset link if an account matches your email." : isJoin ? "Join a community built around thoughtful, homemade food." : "Sign in to find your favourites, follow orders, and discover more home kitchens."}</p>
      </div>
      <form className="auth-form" onSubmit={submit}>
        {isJoin && <>
          <label>Your name<input required minLength={2} maxLength={90} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name"/></label>
          <label>I’m joining as<select value={role} onChange={(event) => setRole(event.target.value as typeof role)}><option value="CUSTOMER">Customer</option><option value="SELLER">Home cook / seller</option><option value="RIDER">Delivery rider</option></select></label>
          {role === "SELLER" && <label>Kitchen name<input required minLength={2} maxLength={90} value={shopName} onChange={(event) => setShopName(event.target.value)} placeholder="Your home kitchen"/></label>}
        </>}
        <label>Email address<input type="email" required autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com"/></label>
        {!isRecovery && <label>Password<span className="auth-password-input"><input type={visible ? "text" : "password"} required minLength={isJoin ? 10 : 1} maxLength={200} autoComplete={isJoin ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isJoin ? "At least 10 characters" : "Your password"}/><button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? "Hide password" : "Show password"}>{visible ? "Hide" : "Show"}</button></span></label>}
        {error && <p className="auth-error" role="alert">{error}</p>}{message && <p className="auth-success" role="status">{message}{developmentResetUrl && <> <Link href={developmentResetUrl}>Open the reset page →</Link></>}</p>}
        <OriginButton className="auth-submit" type="submit" variant="primary" loading={busy} loadingText="One moment…">{isRecovery ? "Send reset link" : isJoin ? "Create account" : "Sign in"}<span aria-hidden="true">→</span></OriginButton>
      </form>
      {mode === "signin" && <Link className="auth-forgot-link" href="/forgot-password">Forgot password?</Link>}
      {isRecovery && <Link className="auth-text-link" href="/signin">← Back to sign in</Link>}
      {!isRecovery && <p className="auth-switch-copy">{isJoin ? "Already have a HomeFoods account?" : "New to HomeFoods?"} <Link href={isJoin ? "/signin" : "/join"}>{isJoin ? "Sign in" : "Join us"}</Link></p>}
      {mode === "signin" && testAccounts && <details className="auth-test-accounts"><summary>Development test accounts</summary><p>Shared development password: <code>password</code></p><ul>{testAccounts.map((account) => <li key={account.email}><button type="button" onClick={() => { setEmail(account.email); setPassword("password"); }}>{account.email}</button><span>{account.role}</span></li>)}</ul></details>}
      <p className="auth-legal">By continuing, you agree to HomeFoods’ <Link href="/#terms">terms</Link> and <Link href="/#privacy">privacy notice</Link>.</p>
    </section>
    <aside className="auth-story" aria-label="HomeFoods story"><div className="auth-story-composition"><Link href="/" className="auth-wordmark auth-desktop-brand" aria-label="HomeFoods home"><span className="auth-brand-mark">⌂</span><span>Home<b>Foods</b></span></Link><div className="auth-story-content"><span className="auth-story-label">MADE WITH A LITTLE MORE HEART</span><h2>From their kitchen<br/>to <em>your table.</em></h2><p>Good food brings people closer. Find the home cooks making something special in Finland.</p></div></div><span className="auth-story-spark" aria-hidden="true">✳</span><span className="auth-story-caption">A good meal always feels like home.</span></aside>
  </main>;
}
