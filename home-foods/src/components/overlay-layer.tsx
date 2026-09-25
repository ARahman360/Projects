"use client";

import { useEffect, useRef, useSyncExternalStore, type MutableRefObject, type ReactNode } from "react";
import { createPortal } from "react-dom";

type OverlayLayerProps = {
  children: ReactNode;
  className: string;
  dialogClassName: string;
  label: string;
  open: boolean;
  onClose: () => void;
  triggerRef?: MutableRefObject<HTMLElement | null>;
  dialogRef: MutableRefObject<HTMLElement | null>;
  initialFocusSelector?: string;
  dismissOnBackdrop?: boolean;
  swipeToClose?: "left" | "right";
};

const focusableSelector = "a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex='-1'])";
const subscribeToNothing = () => () => {};
const getClientMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

/** A single body-level overlay layer used by drawers and modal dialogs. */
export default function OverlayLayer({ children, className, dialogClassName, label, open, onClose, triggerRef, dialogRef, initialFocusSelector, dismissOnBackdrop = false, swipeToClose }: OverlayLayerProps) {
  const mounted = useSyncExternalStore(subscribeToNothing, getClientMountedSnapshot, getServerMountedSnapshot);
  const closeRef = useRef(onClose);
  const layerRef = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const gesture = useRef<{x:number;y:number;dx:number;dragging:boolean}|null>(null);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || !mounted) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const opener = triggerRef?.current;
    const inertSiblings = [...document.body.children].filter((node): node is HTMLElement => node instanceof HTMLElement && node !== layerRef.current).map((node) => ({ node, inert: node.inert }));
    inertSiblings.forEach(({ node }) => { node.inert = true; });
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      const target = initialFocusSelector ? dialog?.querySelector<HTMLElement>(initialFocusSelector) : dialog?.querySelector<HTMLElement>(focusableSelector);
      (target ?? dialog)?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      const layers = document.querySelectorAll("[data-overlay-active]");
      if (layers[layers.length - 1] !== layerRef.current || event.defaultPrevented) return;
      const dialog = dialogRef.current;
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const controls = [...dialog.querySelectorAll<HTMLElement>(focusableSelector)].filter((control) => control.offsetParent !== null);
      if (!controls.length) { event.preventDefault(); dialog.focus(); return; }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      inertSiblings.forEach(({ node, inert }) => { node.inert = inert; });
      (opener ?? previousFocus)?.focus();
    };
  }, [open, mounted, dialogRef, triggerRef, initialFocusSelector]);

  if (!open || !mounted) return null;
  return createPortal(
    <div ref={layerRef} data-overlay-active className={`overlay-layer ${className}`} onMouseDown={(event) => {
      if (dismissOnBackdrop && event.target === event.currentTarget) closeRef.current();
    }}>
      <section ref={dialogRef as MutableRefObject<HTMLElement>} className={dialogClassName} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}
        style={swipeToClose ? {touchAction:"pan-y"} : undefined}
        onDragStart={event=>{if(swipeToClose)event.preventDefault();}}
        onPointerDown={event=>{suppressClick.current=false;if(swipeToClose && event.isPrimary && event.button===0 && !(event.target as HTMLElement).closest("input,textarea,select")) gesture.current={x:event.clientX,y:event.clientY,dx:0,dragging:false};}}
        onPointerMove={event=>{const g=gesture.current;if(!g||!swipeToClose)return;const dx=event.clientX-g.x,dy=event.clientY-g.y;if(!g.dragging&&Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){gesture.current=null;return;}const allowed=swipeToClose==="left"?dx<0:dx>0;if(allowed&&Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.5){g.dragging=true;g.dx=dx;event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.style.translate=`${dx}px 0`;}}}
        onPointerUp={event=>{const g=gesture.current;suppressClick.current=Boolean(g?.dragging);gesture.current=null;event.currentTarget.style.translate="";if(g?.dragging&&Math.abs(g.dx)>=65)closeRef.current();}}
        onPointerCancel={event=>{gesture.current=null;event.currentTarget.style.translate="";}}
        onClickCapture={event=>{if(suppressClick.current){suppressClick.current=false;event.preventDefault();event.stopPropagation();}}}>
        {children}
      </section>
    </div>,
    document.body,
  );
}
