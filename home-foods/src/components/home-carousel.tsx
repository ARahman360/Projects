"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";

export default function HomeCarousel({ id, title, description, href, children, empty, cardKind = "food" }: {
  id: string;
  title: string;
  description: string;
  href: string;
  children: ReactNode;
  empty?: string;
  cardKind?: "food" | "kitchen";
}) {
  const track = useRef<HTMLDivElement>(null);
  const [canBack, setCanBack] = useState(false);
  const [canForward, setCanForward] = useState(false);
  const updateArrows = useCallback(() => {
    const node = track.current;
    if (!node) return;
    setCanBack(node.scrollLeft > 2);
    setCanForward(node.scrollWidth - node.clientWidth - node.scrollLeft > 3);
  }, []);

  useEffect(() => {
    const node = track.current;
    if (!node) return;
    const observer = new ResizeObserver(updateArrows);
    observer.observe(node);
    updateArrows();
    return () => observer.disconnect();
  }, [updateArrows]);

  function scroll(direction: -1 | 1) {
    const node = track.current;
    if (!node) return;
    node.scrollBy({ left: direction * Math.max(node.clientWidth * 0.78, 250), behavior: "smooth" });
  }

  return <section className={`home-carousel home-carousel-${cardKind}`} aria-labelledby={`${id}-title`}>
    <div className="home-carousel-heading">
      <div><h2 id={`${id}-title`}>{title}</h2><p>{description}</p></div>
      <div className="home-carousel-actions">
        <Link href={href} className="home-carousel-see-all">See all <span aria-hidden="true">→</span></Link>
        <button type="button" onClick={() => scroll(-1)} disabled={!canBack} aria-label={`Scroll ${title} backward`} className="carousel-arrow">‹</button>
        <button type="button" onClick={() => scroll(1)} disabled={!canForward} aria-label={`Scroll ${title} forward`} className="carousel-arrow">›</button>
      </div>
    </div>
    {empty ? <div className="carousel-empty">{empty}</div> : <div ref={track} className="home-carousel-track" tabIndex={0} role="region" aria-label={`${title} carousel`} onScroll={updateArrows} onKeyDown={(event) => {
      if (event.key === "ArrowLeft") { event.preventDefault(); scroll(-1); }
      if (event.key === "ArrowRight") { event.preventDefault(); scroll(1); }
    }}>{children}</div>}
  </section>;
}
