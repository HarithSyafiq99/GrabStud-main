"use client";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { lockPageScroll } from "@/lib/loading";
import { Brand } from "./Brand";
import { Icon } from "./Icon";

export function LoadingEmblem({ success = false }: { success?: boolean }) {
  return (
    <div className="booking-progress-emblem" aria-hidden="true">
      <span className="booking-progress-orbit" />
      <span className="booking-progress-logo">
        <Icon name={success ? "check" : "car"} size={35} />
      </span>
    </div>
  );
}
export function LoadingCard({
  label,
  detail,
  success = false,
  titleId,
}: {
  label: string;
  detail?: string;
  success?: boolean;
  titleId?: string;
}) {
  return (
    <div
      className="booking-progress-card"
      data-state={success ? "success" : "loading"}
    >
      <LoadingEmblem success={success} />
      <Brand />
      <div role="status" aria-live="polite" aria-atomic="true">
        <h2 id={titleId}>{label}</h2>
        <p>
          {detail ??
            (success
              ? "Saved successfully. Updating your page."
              : "Please keep this page open while we complete this step.")}
        </p>
      </div>
      {!success ? (
        <div className="booking-progress-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      ) : null}
    </div>
  );
}
export function LoadingOverlay({
  active,
  label,
  detail,
  success = false,
}: {
  active: boolean;
  label: string;
  detail?: string;
  success?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const background = new Map<HTMLElement, boolean>();
    const blockBackground = () => {
      for (const node of document.body.children) {
        if (
          !(node instanceof HTMLElement) ||
          node.classList.contains("booking-progress")
        )
          continue;
        if (!background.has(node)) background.set(node, node.inert);
        node.inert = true;
      }
    };
    blockBackground();
    const observer = new MutationObserver(blockBackground);
    observer.observe(document.body, { childList: true });
    const releaseScroll = lockPageScroll();
    panelRef.current?.focus({ preventScroll: true });
    const keepFocus = (event: FocusEvent) => {
      if (
        event.target instanceof Node &&
        !panelRef.current?.contains(event.target)
      ) {
        panelRef.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("focusin", keepFocus, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", keepFocus, true);
      background.forEach((inert, node) => {
        node.inert = inert;
      });
      releaseScroll();
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, [active]);
  if (!active || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="booking-progress"
      data-state={success ? "success" : "loading"}
    >
      <div
        className="loading-dialog"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Tab" || event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <LoadingCard
          label={label}
          detail={detail}
          success={success}
          titleId={titleId}
        />
      </div>
    </div>,
    document.body,
  );
}
