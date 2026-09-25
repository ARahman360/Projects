"use client";

import OrderNotifications from "./order-notifications";
import { useEffect, useState } from "react";

export default function SiteEnhancements() {
  const [progress, setProgress] = useState(0);
  const [showTop, setShowTop] = useState(false);
  const [cookieVisible, setCookieVisible] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

  useEffect(() => {
    const applyTheme = () => { document.documentElement.dataset.theme = localStorage.getItem("home-foods-theme") === "dark" ? "dark" : "light"; };
    applyTheme();
    window.addEventListener("storage", applyTheme);
    queueMicrotask(() => setCookieVisible(!window.localStorage.getItem("home-foods-cookie-choice")));

    const updateScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0);
      setShowTop(window.scrollY > 500);
    };
    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });

    const tagOutboundLinks = () => {
      for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href^="http"]')) {
        try {
          const url = new URL(link.href);
          if (url.origin === window.location.origin) continue;
          url.searchParams.set("utm_source", "home-foods");
          url.searchParams.set("utm_medium", "website");
          url.searchParams.set("utm_campaign", "outbound");
          link.href = url.toString();
        } catch { /* Ignore malformed external links. */ }
      }
    };
    tagOutboundLinks();
    const observer = new MutationObserver(tagOutboundLinks);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { window.removeEventListener("storage", applyTheme); window.removeEventListener("scroll", updateScroll); observer.disconnect(); };
  }, []);

  function dismissCookies(choice: "accepted" | "rejected") {
    window.localStorage.setItem("home-foods-cookie-choice", choice);
    setCookieVisible(false);
  }

  return <><OrderNotifications/>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <div className="scroll-progress" style={{ width: `${progress}%` }} aria-hidden="true" />
    <div className="floating-tools" aria-label="Site tools">
      <button className="contact-float" type="button" onClick={() => setContactOpen((open) => !open)} aria-expanded={contactOpen}>✉ <span>Contact</span></button>
      {showTop && <button className="back-to-top" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to top">↑</button>}
    </div>
    {contactOpen && <aside className="contact-popover" aria-label="Contact HomeFoods"><button className="contact-close" type="button" onClick={() => setContactOpen(false)} aria-label="Close contact panel">×</button><span className="eyebrow">HERE TO HELP</span><h2>Let’s talk.</h2><p>{supportEmail ? "Send us a note and our team will get back to you." : "For an order, open My account and check your order details. General support is not available just yet."}</p>{supportEmail && <a className="contact-email" href={`mailto:${supportEmail}`}>Email support →</a>}<a className="contact-orders" href="/workspace">My orders and account</a></aside>}
    {cookieVisible && <aside className="cookie-banner" aria-label="Cookie notice"><div><strong>A small cookie note</strong><p>HomeFoods uses essential cookies to keep your account signed in. Your choice is saved on this device.</p></div><div className="cookie-actions"><button type="button" onClick={() => dismissCookies("rejected")}>Essential only</button><button type="button" onClick={() => dismissCookies("accepted")}>Got it</button></div></aside>}
  </>;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const saved = window.localStorage.getItem("home-foods-theme") === "dark" ? "dark" : "light";
    queueMicrotask(() => setTheme(saved));
    document.documentElement.dataset.theme = saved;
    const sync=()=>setTheme(document.documentElement.dataset.theme==="dark"?"dark":"light");
    const observer=new MutationObserver(sync);observer.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
    return ()=>observer.disconnect();
  }, []);
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("home-foods-theme", next);
  }
  return <button className="sidebar-theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}><span aria-hidden="true">{theme === "dark" ? "☼" : "◐"}</span> {theme === "dark" ? "Light mode" : "Dark mode"}</button>;
}
