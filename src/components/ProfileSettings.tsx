"use client";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/types";
import { api } from "@/lib/client";
import { Modal } from "./Modal";
import { ProfilePhotoPicker } from "./ProfilePhotoPicker";
import { VehicleFields } from "./VehicleFields";
import { Avatar } from "./Avatar";
import { BookingProgress } from "./BookingProgress";
import { Notice } from "./UI";

export function ProfileSettings({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="btn btn-secondary profile-trigger"
        type="button"
        aria-label="My profile"
        onClick={() => setOpen(true)}
      >
        <Avatar name={user.name} photo={user.profile_photo} />
        My profile
      </button>
      {open ? (
        <ProfileEditor user={user} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
function ProfileEditor({
  user,
  onClose,
}: {
  user: SessionUser;
  onClose: () => void;
}) {
  const [photo, setPhoto] = useState(user.profile_photo),
    [phone, setPhone] = useState(user.phone_number),
    [vehicle, setVehicle] = useState({
      car_colour: user.car_colour,
      car_type: user.car_type,
      car_plate: user.car_plate,
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const pending = busy || navigating;
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (saved && !pending) onClose();
  }, [saved, pending, onClose]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (user.role === "driver" && !photo) {
      setError("Please add your profile photo.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/me", {
        method: "PATCH",
        loadingLabel: "Saving your profile…",
        body: JSON.stringify({
          phone_number: phone,
          profile_photo: photo,
          ...(user.role === "driver" ? vehicle : {}),
        }),
      });
      startNavigation(() => router.refresh());
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <BookingProgress active={pending} label="Saving your profile…" />
      <Modal
        open
        title="My profile"
        onClose={() => {
          if (!pending) onClose();
        }}
      >
        <form onSubmit={save}>
          <p className="text-xs muted mb-4">
            Your photo and contact details are shared with the driver or
            passenger on your journey.
          </p>
          {user.role !== "admin" ? (
            <ProfilePhotoPicker
              value={photo}
              onChange={setPhoto}
              required={user.role === "driver"}
              name={user.name}
            />
          ) : null}
          <label className="field mt-4">
            Phone number
            <input
              className="input"
              type="tel"
              required
              maxLength={25}
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          {user.role === "driver" ? (
            <VehicleFields value={vehicle} onChange={setVehicle} />
          ) : null}
          <Notice message={error} error />
          <div className="action-group mt-4">
            <button className="btn btn-primary" disabled={pending}>
              {pending ? "Saving…" : "Save profile"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
