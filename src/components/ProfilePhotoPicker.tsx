"use client";
import { useId, useState } from "react";
import { beginLoading } from "@/lib/loading";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

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
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext("2d");
      if (!context) throw Error("Could not process this photo.");
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      context.fillStyle = "#fff";
      context.fillRect(0, 0, 256, 256);
      context.drawImage(
        image,
        (image.naturalWidth - side) / 2,
        (image.naturalHeight - side) / 2,
        side,
        side,
        0,
        0,
        256,
        256,
      );
      const photo = canvas.toDataURL("image/jpeg", 0.85);
      if (photo.length > 400_000)
        throw Error("This photo is too large. Choose a smaller image.");
      onChange(photo);
    } catch {
      setError("Could not read this photo. Choose another image.");
    } finally {
      URL.revokeObjectURL(url);
      finish();
    }
  }
  return (
    <div className="photo-picker">
      <Avatar name={name || "You"} photo={value} large />
      <div>
        <label className="photo-upload btn btn-secondary" htmlFor={id}>
          <Icon name="upload" size={16} />
          {value ? "Change photo" : "Add profile photo"}
          <input
            id={id}
            type="file"
            className="sr-only"
            accept="image/png,image/jpeg,image/webp"
            required={required && !value}
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
              ? "Required for drivers. Use a clear photo of yourself."
              : "Optional. Help your driver recognise you.")}
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
  );
}
