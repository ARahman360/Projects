"use client";

import { useCallback, type CSSProperties, type PointerEvent, type ReactNode } from "react";

export type GlowColor = "blue" | "purple" | "green" | "red" | "orange";
export type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
  glowColor?: GlowColor;
  size?: "small" | "medium" | "large";
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  customSize?: boolean;
};

const colorValues: Record<GlowColor, string> = {
  blue: "#71a9ef",
  purple: "#a990e8",
  green: "#79b98a",
  red: "#df8070",
  orange: "#e6a06f",
};

/** Lightweight pointer-local spotlight. It writes CSS variables directly to avoid rerendering on pointer movement. */
export function SpotlightCard({ children, className = "", glowColor = "green", size = "medium", width, height, customSize = false }: SpotlightCardProps) {
  const style: CSSProperties & { "--spotlight-color"?: string } = {
    width: customSize ? width : width ?? "100%",
    height: customSize ? height : height,
    "--spotlight-color": colorValues[glowColor],
  };

  const trackPointer = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--spotlight-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--spotlight-y", `${event.clientY - rect.top}px`);
    event.currentTarget.dataset.pointerActive = "true";
  }, []);

  return <div className={`spotlight-card spotlight-card--${size}${className ? ` ${className}` : ""}`} style={style} onPointerMove={trackPointer} onPointerLeave={(event) => { delete event.currentTarget.dataset.pointerActive; }}>
    <span className="spotlight-card__glow" aria-hidden="true"/>
    <div className="spotlight-card__content">{children}</div>
  </div>;
}

export default SpotlightCard;
