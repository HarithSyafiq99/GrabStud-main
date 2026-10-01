/* eslint-disable @next/next/no-img-element -- Private base64 document previews are intentionally not sent through an image proxy. */
"use client";
import { useCallback, useId, useState } from "react";
import { Icon } from "./Icon";
type Props = {
  label: string;
  hint?: string;
  required?: boolean;
  onFile: (dataUrl: string | null) => void;
};
export function Dropzone({ label, hint, required, onFile }: Props) {
  const id = useId();
  const [preview, setPreview] = useState<string | null>(null),
    [name, setName] = useState(""),
    [drag, setDrag] = useState(false),
    [error, setError] = useState("");
  const read = useCallback(
    (file?: File) => {
      if (!file) return;
      setError("");
      if (
        !["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(
          file.type,
        )
      ) {
        setError("Choose a PNG, JPEG, WebP or PDF file.");
        return;
      }
      if (file.size > 1500000) {
        setError("The file must be smaller than 1.5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const value = String(reader.result);
        setPreview(file.type.startsWith("image/") ? value : null);
        setName(file.name);
        onFile(value);
      };
      reader.onerror = () => setError("Could not read this file. Try again.");
      reader.readAsDataURL(file);
    },
    [onFile],
  );
  return (
    <div>
      <label
        htmlFor={id}
        className={`upload-zone ${drag ? "drag" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          read(e.dataTransfer.files[0]);
        }}
      >
        <input
          id={id}
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="sr-only"
          required={required && !name}
          onChange={(e) => read(e.target.files?.[0])}
        />
        {preview ? (
          <img src={preview} alt="Uploaded document preview" />
        ) : (
          <span className="upload-icon">
            <Icon name={name ? "file" : "upload"} />
          </span>
        )}
        <div className="min-w-0">
          <strong>
            {label}
            {required ? " *" : ""}
          </strong>
          <p className="truncate">
            {name ||
              hint ||
              "Drop your file here, or click to browse · Max 1.5MB"}
          </p>
        </div>
        {name ? (
          <Icon name="check" size={16} className="ml-auto text-emerald-600" />
        ) : null}
      </label>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
