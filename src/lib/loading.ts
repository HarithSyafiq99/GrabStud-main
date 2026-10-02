export type LoadingTask = {
  label: string;
  detail?: string;
  success: boolean;
  mode: "blocking" | "background";
  priority: number;
};

const tasks = new Map<symbol, LoadingTask>();
const listeners = new Set<() => void>();
let snapshot: LoadingTask | null = null;

function publish() {
  let next: LoadingTask | null = null;
  for (const task of tasks.values()) {
    if (
      !next ||
      (task.mode === "blocking" && next.mode === "background") ||
      (task.mode === next.mode && task.priority >= next.priority)
    )
      next = task;
  }
  if (snapshot === next) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export function beginLoading(
  label: string,
  options: Partial<Omit<LoadingTask, "label">> = {},
) {
  if (typeof window === "undefined") return () => {};
  const token = Symbol("loading");
  tasks.set(token, {
    label,
    mode: "blocking",
    priority: 0,
    success: false,
    ...options,
  });
  publish();
  return () => {
    tasks.delete(token);
    publish();
  };
}

export function subscribeLoading(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export const getLoadingSnapshot = () => snapshot;
export const getServerLoadingSnapshot = () => null;

let scrollLocks = 0;
let originalOverflow = "";
export function lockPageScroll() {
  if (scrollLocks++ === 0) {
    originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--scrollLocks === 0) document.body.style.overflow = originalOverflow;
  };
}
