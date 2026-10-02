"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  getLoadingSnapshot,
  getServerLoadingSnapshot,
  subscribeLoading,
} from "@/lib/loading";
import { LoadingEmblem, LoadingOverlay } from "./LoadingOverlay";

export function AppLoadingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const task = useSyncExternalStore(
    subscribeLoading,
    getLoadingSnapshot,
    getServerLoadingSnapshot,
  );
  return (
    <>
      {children}
      <LoadingOverlay
        active={task?.mode === "blocking"}
        label={task?.label ?? "Loading…"}
        detail={task?.detail}
        success={task?.success}
      />
      {task?.mode === "background" && typeof document !== "undefined"
        ? createPortal(
            <div
              className="background-loading"
              role="status"
              aria-live="polite"
            >
              <LoadingEmblem />
              <span>{task.label}</span>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
