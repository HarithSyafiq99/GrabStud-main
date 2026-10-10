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
export function ProfileEditor({
  user,
  onClose,
  inline = false,
  onSaved,
}: {
  user: SessionUser;
  onClose: () => void;
  inline?: boolean;
  onSaved?: () => void;
}) {
  const [name, setName] = useState(user.name),
    [photo, setPhoto] = useState(user.profile_photo),
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
    if (saved && !pending && !inline) {
      onSaved?.();
      onClose();
    }
  }, [saved, pending, onClose, inline, onSaved]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (user.role === "driver" && !photo) {
      setError("Please add your profile photo.");
      return;
    }
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await api("/api/auth/me", {
        method: "PATCH",
        loadingLabel: "Saving your profile…",
        body: JSON.stringify({
          name,
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
  const form = (
    <form onSubmit={save}>
      <fieldset disabled={pending} className="profile-fields">
        <p className="text-xs muted mb-4">
          Your photo and contact details are shared with the driver or passenger
          on your journey.
        </p>
        {user.role !== "admin" ? (
          <ProfilePhotoPicker
            value={photo}
            onChange={setPhoto}
            required={user.role === "driver"}
            name={name}
          />
        ) : null}
        <label className="field mt-4">
          Full name
          <input
            className="input"
            required
            maxLength={100}
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="field mt-4">
          Email address
          <input
            className="input"
            type="email"
            value={user.email}
            readOnly
            aria-describedby="profile-email-help"
          />
        </label>
        <p id="profile-email-help" className="text-xs muted mt-2">
          Contact the administrator to change your registered email.
        </p>
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
        <Notice message={inline && saved ? "Your profile was saved." : ""} />
        <div className="action-group mt-4">
          <button className="btn btn-primary" disabled={pending}>
            {pending ? "Saving…" : "Save profile"}
          </button>
          {!inline ? (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </fieldset>
    </form>
  );
  return (
    <>
      <BookingProgress active={pending} label="Saving your profile…" />
      {inline ? (
        form
      ) : (
        <Modal
          open
          title="Edit profile"
          onClose={() => {
            if (!pending) onClose();
          }}
        >
          {form}
        </Modal>
      )}
    </>
  );
}
