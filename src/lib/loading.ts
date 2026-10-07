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
const interactionLocks = new Map<
  HTMLElement,
  { count: number; original: boolean }
>();
export function lockPageBackground(exempt: (node: HTMLElement) => boolean) {
  const held = new Set<HTMLElement>();
  const block = () => {
    for (const child of document.body.children) {
      if (!(child instanceof HTMLElement) || exempt(child) || held.has(child))
        continue;
      const lock = interactionLocks.get(child) ?? {
        count: 0,
        original: child.inert,
      };
      lock.count++;
      interactionLocks.set(child, lock);
      held.add(child);
      child.inert = true;
    }
  };
  block();
  const observer = new MutationObserver(block);
  observer.observe(document.body, { childList: true });
  return () => {
    observer.disconnect();
    for (const node of held) {
      const lock = interactionLocks.get(node);
      if (!lock) continue;
      if (--lock.count === 0) {
        node.inert = lock.original;
        interactionLocks.delete(node);
      }
    }
    held.clear();
  };
}
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
