/* eslint-disable @next/next/no-img-element -- Local passport photo preview uses a private data URL. */
"use client";
import { useId, useState } from "react";
import { beginLoading } from "@/lib/loading";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

export function ProfilePhotoPicker({
  value,
  onChange,
  required = false,
  name = "You",
  description,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  required?: boolean;
  name?: string;
  description?: string;
}) {
  const id = useId();
  const [error, setError] = useState("");
  const [candidate, setCandidate] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  async function read(file?: File) {
    if (!file) return;
    setError("");
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 5_000_000
    ) {
      setError("Choose a PNG, JPEG or WebP photo smaller than 5MB.");
      return;
    }
    const finish = beginLoading("Preparing your profile photo…");
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const ratio = image.naturalWidth / image.naturalHeight;
      if (ratio < 0.7 || ratio > 0.85)
        throw Error(
          "Choose a passport-style portrait with about 35:45 proportions. Square and landscape photos are not accepted.",
        );
      if (image.naturalWidth < 350 || image.naturalHeight < 450)
        throw Error("Choose a clear portrait at least 350 × 450 pixels.");
      const canvas = document.createElement("canvas");
      canvas.width = 350;
      canvas.height = 450;
      const context = canvas.getContext("2d");
      if (!context) throw Error("Could not process this photo.");
      const width = Math.min(image.naturalWidth, (image.naturalHeight * 7) / 9);
      const height = (width * 9) / 7;
      context.fillStyle = "#fff";
      context.fillRect(0, 0, 350, 450);
      context.drawImage(
        image,
        (image.naturalWidth - width) / 2,
        (image.naturalHeight - height) / 2,
        width,
        height,
        0,
        0,
        350,
        450,
      );
      const photo = canvas.toDataURL("image/jpeg", 0.85);
      if (photo.length > 400_000)
        throw Error("This photo is too large. Choose a smaller image.");
      setCandidate(photo);
      setConfirmed(false);
    } catch (e) {
      setError(
        e instanceof Error && e.name === "Error"
          ? e.message
          : "Could not read this photo. Choose another image.",
      );
    } finally {
      URL.revokeObjectURL(url);
      finish();
    }
  }
  return (
    <>
      <div className="photo-picker">
        <Avatar name={name || "You"} photo={value} large />
        <div>
          <label className="photo-upload btn btn-secondary" htmlFor={id}>
            <Icon name="upload" size={16} />
            {value ? "Change photo" : "Add passport photo"}
            <input
              id={id}
              type="file"
              className="sr-only"
              accept="image/png,image/jpeg,image/webp"
              aria-label={`Profile photo${required ? " (required)" : " (optional)"}`}
              onChange={(event) => {
                void read(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          <p className="text-xs muted mt-2">
            {description ??
              (required
                ? "Required for drivers. Passport-style photos only."
                : "Optional. Help your driver recognise you.")}
          </p>
          <p className="photo-guidelines text-xs muted mt-2">
            Face forward with your head and shoulders centred. Use a plain white
            or light background, even lighting and no filters, sunglasses or
            other people. Portrait PNG, JPEG or WebP, at least 350 × 450 pixels
            (35:45 proportions), up to 5MB.
          </p>
          {value && !required ? (
            <button
              type="button"
              className="text-xs text-lilac-deep mt-2"
              onClick={() => onChange(null)}
            >
              Remove photo
            </button>
          ) : null}
          {error ? (
            <p role="alert" className="text-xs text-rose-600 mt-2">
              {error}
            </p>
          ) : null}
        </div>
      </div>
      {candidate ? (
        <Modal
          open
          title="Check your passport photo"
          onClose={() => setCandidate(null)}
          className="passport-photo-modal"
        >
          <img
            className="passport-preview"
            src={candidate}
            alt="Preview of your passport-style profile photo"
          />
          <p className="text-sm muted mt-4">
            Make sure your full face is visible, centred and clear against a
            plain light background. Only your own passport-style photo is
            allowed.
          </p>
          <label className="photo-confirmation mt-4">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I confirm this is a clear, passport-style photo of me and it meets
            the guidelines.
          </label>
          <div className="action-group mt-4">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!confirmed}
              onClick={() => {
                onChange(candidate);
                setCandidate(null);
              }}
            >
              Use this photo
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCandidate(null)}
            >
              Choose another
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
