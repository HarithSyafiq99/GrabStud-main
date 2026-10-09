"use client";
import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  getLoadingSnapshot,
  getServerLoadingSnapshot,
  subscribeLoading,
} from "@/lib/loading";
import type { SessionUser } from "@/lib/types";
import { api } from "@/lib/client";
import { Modal } from "./Modal";
import { Icon } from "./Icon";
import { Notice } from "./UI";

const STEPS = {
  passenger: [
    {
      icon: "pin",
      title: "Tell us where you’re going",
      text: "Enter each address and tap Find on map, or mark a point to fill its address automatically. Select how many passengers are travelling, including yourself. Check both pins, add a pickup entrance and choose your departure time.",
    },
    {
      icon: "wallet",
      title: "Review your driver’s offer",
      text: "Your latest request appears at the top in Current Booking; older journeys stay in History. A driver chooses your request and sends a fare. Check their photo, car and price, then tap Agree & book when you’re happy.",
    },
    {
      icon: "bell",
      title: "Meet your driver",
      text: "Your driver sends a reminder when they arrive. Tap I’m on my way, check the car’s plate number, and pay directly in cash or QR.",
    },
  ],
  driver: [
    {
      icon: "users",
      title: "Choose a passenger on your route",
      text: "Add your photo and car details in My profile. Search passenger requests by place name, check the passenger count and read pickup remarks. Tap View location map to see the passenger's pickup and destination pins.",
    },
    {
      icon: "wallet",
      title: "Set a fare and wait for agreement",
      text: "Use the suggested fare or enter your own. Send your offer; the journey is booked only after the passenger agrees.",
    },
    {
      icon: "pin",
      title: "Send a pickup reminder",
      text: "Tap I’ve arrived when you reach the pickup point. The passenger gets a popup and can reply I’m on my way. The agreed fare is added once to your Wallet’s daily, weekly and monthly totals.",
    },
  ],
};
export function FirstVisitGuide({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(!user.onboarding_seen_at),
    [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const task = useSyncExternalStore(
    subscribeLoading,
    getLoadingSnapshot,
    getServerLoadingSnapshot,
  );
  const router = useRouter();
  if (user.role === "admin") return null;
  const steps = STEPS[user.role],
    current = steps[step];
  async function finish() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/me", {
        method: "PATCH",
        loadingLabel: "Saving your welcome preferences…",
        body: JSON.stringify({ onboarding_seen: true }),
      });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open && task?.mode !== "blocking"}
      title="Welcome to GrabStudent"
      onClose={() => {
        void finish();
      }}
      className="first-visit-guide"
    >
      <p className="text-xs muted">
        A quick guide for your first{" "}
        {user.role === "driver" ? "drive" : "journey"}.
      </p>
      <div className="guide-step" key={step}>
        <span className="guide-icon">
          <Icon name={current.icon} size={28} />
        </span>
        <span className="eyebrow">
          STEP {step + 1} OF {steps.length}
        </span>
        <h3>{current.title}</h3>
        <p>{current.text}</p>
      </div>
      <div
        className="guide-progress"
        aria-label={`Step ${step + 1} of ${steps.length}`}
      >
        {steps.map((_, index) => (
          <span key={index} data-active={index === step} />
        ))}
      </div>
      <Notice message={error} error />
      <div className="guide-actions">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={() => (step ? setStep(step - 1) : void finish())}
        >
          {step ? "Back" : "Skip for now"}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() =>
            step === steps.length - 1 ? void finish() : setStep(step + 1)
          }
        >
          {busy
            ? "Saving…"
            : step === steps.length - 1
              ? "Let’s get started"
              : "Next"}
          <Icon name="arrow" size={16} />
        </button>
      </div>
    </Modal>
  );
}
