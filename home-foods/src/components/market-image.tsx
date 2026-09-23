"use client";
/* eslint @next/next/no-img-element: off -- Native img keeps browser lazy loading and supports arbitrary seeded image URLs. */

import { useState } from "react";

export default function MarketImage({ src, alt, className = "", fallbackSrc, eager = false }: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackSrc?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const current = failed ? fallbackSrc : src;
  if (!current || fallbackFailed) return <div className={`market-image-fallback ${className}`} role="img" aria-label={alt}><span aria-hidden="true">♨</span><small>{alt}</small></div>;
  return <img className={className} src={current} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" fetchPriority={eager ? "high" : "auto"} onError={() => failed ? setFallbackFailed(true) : setFailed(true)} />;
}
