"use client";

import { useState } from "react";
import Link from "next/link";
import SpotlightCard, { type GlowColor } from "@/src/components/ui/spotlight-card";
import { OriginButton } from "@/src/components/ui/origin-button";

const colors: GlowColor[] = ["green", "orange", "purple", "blue", "red"];

export default function UiPreview() {
  const [dark, setDark] = useState(false);
  const [loading, setLoading] = useState(false);
  return <main className="ui-preview" data-preview-theme={dark ? "dark" : "light"}>
    <div className="ui-preview-toolbar"><OriginButton variant="secondary" onClick={() => setDark((value) => !value)}>Preview {dark ? "light" : "dark"} mode</OriginButton><Link href="/" className="origin-button origin-button--secondary">← HomeFoods</Link></div>
    <span className="auth-kicker">DEVELOPMENT PREVIEW</span><h1>HomeFoods UI components</h1><p className="ui-preview-lede">A responsive visual check for the spotlight cards and origin-fill buttons. Cards use pointer-local CSS effects, without adding animations to every food listing.</p>
    <h2>Glow colors</h2><div className="ui-preview-grid">{colors.map((color) => <SpotlightCard key={color} glowColor={color} className="ui-preview-card"><div className="ui-preview-card-content"><small>{color} glow</small><strong>Thoughtfully made</strong><span>A sample card without invented business metrics.</span></div></SpotlightCard>)}</div>
    <h2>Card sizes and custom dimensions</h2><div className="ui-preview-size-row"><SpotlightCard size="small" glowColor="green"><div className="ui-preview-card-content"><small>Small</small><strong>Compact</strong></div></SpotlightCard><SpotlightCard size="medium" glowColor="orange"><div className="ui-preview-card-content"><small>Medium</small><strong>Flexible</strong></div></SpotlightCard><SpotlightCard size="large" glowColor="purple"><div className="ui-preview-card-content"><small>Large</small><strong>Room to breathe</strong></div></SpotlightCard><SpotlightCard customSize width="100%" height={170} glowColor="blue"><div className="ui-preview-card-content"><small>Custom size · responsive width</small><strong>170px tall</strong></div></SpotlightCard></div>
    <h2>OriginButton variants and states</h2><div className="ui-preview-buttons"><OriginButton>Primary action</OriginButton><OriginButton variant="secondary">Secondary</OriginButton><OriginButton variant="promotional">Promotional</OriginButton><OriginButton variant="destructive">Destructive</OriginButton><OriginButton disabled>Disabled</OriginButton><OriginButton loading={loading} loadingText="Saving…" onClick={() => { setLoading(true); window.setTimeout(() => setLoading(false), 1000); }}>Loading demo</OriginButton></div>
    <p className="ui-preview-lede">Try pointer activation, then use Tab, Enter, or Space. On touch screens the fill is skipped so it does not interfere with scrolling.</p>
  </main>;
}
