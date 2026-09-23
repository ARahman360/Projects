"use client";

import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes, type MouseEvent, type PointerEvent } from "react";

export type OriginButtonVariant = "primary" | "secondary" | "promotional" | "destructive";

export type OriginButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: OriginButtonVariant;
  loading?: boolean;
  loadingText?: string;
};

/** Button with a light CSS radial fill that starts at the pointer (or center for keyboard clicks). */
export const OriginButton = forwardRef<HTMLButtonElement, OriginButtonProps>(function OriginButton(
  { className = "", variant = "primary", loading = false, loadingText = "Working…", disabled, onClick, onPointerDown, children, ...props },
  forwardedRef,
) {
  const elementRef = useRef<HTMLButtonElement | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);
  }, []);

  function setRef(element: HTMLButtonElement | null) {
    elementRef.current = element;
    if (typeof forwardedRef === "function") forwardedRef(element);
    else if (forwardedRef) forwardedRef.current = element;
  }

  function recordPointer(event: PointerEvent<HTMLButtonElement>) {
    onPointerDown?.(event);
    if (event.defaultPrevented || event.pointerType === "touch" || !elementRef.current) return;
    const rect = elementRef.current.getBoundingClientRect();
    elementRef.current.style.setProperty("--origin-x", `${event.clientX - rect.left}px`);
    elementRef.current.style.setProperty("--origin-y", `${event.clientY - rect.top}px`);
  }

  function activate(event: MouseEvent<HTMLButtonElement>) {
    if (disabled || loading) {
      event.preventDefault();
      return;
    }
    const element = elementRef.current;
    if (element && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (event.detail === 0) {
        element.style.setProperty("--origin-x", "50%");
        element.style.setProperty("--origin-y", "50%");
      }
      element.dataset.originAnimating = "true";
      if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        if (element.isConnected) delete element.dataset.originAnimating;
      }, 520);
    }
    onClick?.(event);
  }

  return <button
    {...props}
    ref={setRef}
    className={`origin-button origin-button--${variant}${className ? ` ${className}` : ""}`}
    disabled={Boolean(disabled || loading)}
    aria-busy={loading || props["aria-busy"] || undefined}
    onPointerDown={recordPointer}
    onClick={activate}
  ><span className="origin-button__fill" aria-hidden="true"/><span className="origin-button__content">{loading ? <><span className="origin-button__spinner" aria-hidden="true"/>{loadingText}</> : children}</span></button>;
});

OriginButton.displayName = "OriginButton";
