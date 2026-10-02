"use client";

import { Icon } from "@/components/Icon";

// Keep the confirmation visible briefly before the updated order replaces it.
export const ACTION_SUCCESS_MS = 650;

export function ActionButton({
  children,
  loadingLabel,
  successLabel,
  pending = false,
  success = false,
  disabled = false,
  type = "button",
  onClick,
}: {
  children: string;
  loadingLabel: string;
  successLabel: string;
  pending?: boolean;
  success?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  const state = success ? "success" : pending ? "loading" : "idle";
  const label = success ? successLabel : pending ? loadingLabel : children;

  return (
    <>
      <button
        type={type}
        className="btn btn-success btn-action"
        data-state={state}
        disabled={disabled || pending || success}
        aria-busy={pending && !success}
        onClick={onClick}
      >
        <span className="btn-action-icon" aria-hidden="true">
          {success ? (
            <svg className="btn-action-check" viewBox="0 0 24 24" fill="none">
              <path d="m5 12 4 4L19 6" />
            </svg>
          ) : pending ? (
            <span className="btn-action-spinner" />
          ) : (
            <Icon name="check" size={14} />
          )}
        </span>
        <span className="btn-action-label">
          {/* Reserve each label's width so the button does not jump on click. */}
          {[children, loadingLabel, successLabel].map((text, index) => (
            <span
              className="btn-action-placeholder"
              aria-hidden="true"
              key={index}
            >
              {text}
            </span>
          ))}
          <span className="btn-action-text" key={state}>
            {label}
          </span>
        </span>
      </button>
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {success ? successLabel : pending ? loadingLabel : ""}
      </span>
    </>
  );
}
