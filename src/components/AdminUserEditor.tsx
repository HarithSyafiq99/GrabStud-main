/* eslint-disable @next/next/no-img-element -- Admin document previews use private base64 images. */
"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Role, UserRecord, UserStatus } from "@/lib/types";
import { api } from "@/lib/client";
import { Modal } from "./Modal";
import { ProfilePhotoPicker } from "./ProfilePhotoPicker";
import { VehicleFields } from "./VehicleFields";
import { Dropzone } from "./Dropzone";
import { Icon } from "./Icon";
import { Notice } from "./UI";

export function AdminUserEditor({
  user,
  onClose,
  onSaved,
}: {
  user: UserRecord;
  onClose: () => void;
  onSaved: (name: string) => void | Promise<void>;
}) {
  const [name, setName] = useState(user.name),
    [email, setEmail] = useState(user.email),
    [phone, setPhone] = useState(user.phone_number),
    [number, setNumber] = useState(user.student_number),
    [role, setRole] = useState<Role>(user.role),
    [status, setStatus] = useState<UserStatus>(user.status),
    [photo, setPhoto] = useState(user.profile_photo),
    [studentDoc, setStudentDoc] = useState(user.student_id_doc),
    [licenseDoc, setLicenseDoc] = useState(user.license_doc),
    [vehicle, setVehicle] = useState({
      car_colour: user.car_colour,
      car_type: user.car_type,
      car_plate: user.car_plate,
    }),
    [changingPassword, setChangingPassword] = useState(false),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [showPassword, setShowPassword] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (changingPassword && password !== confirm) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api<{ user: UserRecord; redirect?: string }>(
        "/api/admin/users",
        {
          method: "PATCH",
          loadingLabel: "Saving account changes…",
          body: JSON.stringify({
            userId: user.id,
            action: "edit",
            expectedUpdatedAt: user.updated_at,
            changes: {
              name,
              email,
              phone_number: phone,
              student_number: number,
              role,
              status,
              profile_photo: photo,
              student_id_doc: studentDoc,
              license_doc: licenseDoc,
              ...vehicle,
              ...(changingPassword ? { password } : {}),
            },
          }),
        },
      );
      setPassword("");
      setConfirm("");
      if (result.redirect && result.redirect !== "/admin") {
        onClose();
        router.replace(result.redirect);
        router.refresh();
        return;
      }
      await onSaved(result.user.name);
      if (result.redirect) router.refresh();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const approvedDriver = role === "driver" && status === "approved";
  return (
    <Modal
      open
      title={`Edit account · ${user.name}`}
      onClose={() => {
        if (!busy) onClose();
      }}
      className="admin-user-editor"
    >
      <form onSubmit={save} autoComplete="off">
        <p className="text-xs muted mb-4">
          Update this user’s details and account access. Passwords are private;
          set a new password only when needed.
        </p>
        <fieldset disabled={busy} className="admin-editor-fields">
          <section
            className="admin-editor-section"
            aria-labelledby="admin-identity-title"
          >
            <h3 id="admin-identity-title">Account information</h3>
            <div className="admin-editor-grid">
              <label className="field">
                Full name
                <input
                  className="input"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="field">
                Email address
                <input
                  className="input"
                  type="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="field">
                Phone number
                <input
                  className="input"
                  type="tel"
                  required={role !== "admin"}
                  maxLength={25}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +60123456789"
                />
              </label>
              <label className="field">
                Student / account number
                <input
                  className="input"
                  required
                  maxLength={40}
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                />
              </label>
              <label className="field">
                Role
                <select
                  className="input"
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                >
                  <option value="passenger">Passenger</option>
                  <option value="driver">Driver</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label className="field">
                Account status
                <select
                  className="input"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as UserStatus)}
                >
                  <option value="pending">Pending review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
            </div>
          </section>
          <section
            className="admin-editor-section"
            aria-labelledby="admin-profile-title"
          >
            <h3 id="admin-profile-title">Profile & car details</h3>
            <ProfilePhotoPicker
              value={photo}
              onChange={setPhoto}
              name={name}
              required={approvedDriver}
              description="Choose a clear profile photo. Approved drivers must have one."
            />
            {role === "driver" ? (
              <VehicleFields
                value={vehicle}
                onChange={setVehicle}
                required={approvedDriver}
              />
            ) : null}
          </section>
          <section
            className="admin-editor-section"
            aria-labelledby="admin-documents-title"
          >
            <h3 id="admin-documents-title">Verification documents</h3>
            <div className="admin-editor-grid">
              {[
                {
                  label: "Student ID",
                  value: studentDoc,
                  set: setStudentDoc,
                  required: role !== "admin" && status === "approved",
                },
                {
                  label: "Driving license",
                  value: licenseDoc,
                  set: setLicenseDoc,
                  required: approvedDriver,
                },
              ].map((doc) => (
                <div key={doc.label} className="admin-document-field">
                  <Dropzone
                    label={doc.label}
                    required={doc.required && !doc.value}
                    hint={
                      doc.value
                        ? "Document saved. Choose a replacement."
                        : "PNG, JPEG, WebP or PDF · Max 1.5MB"
                    }
                    onFile={doc.set}
                  />
                  {doc.value ? (
                    <div className="admin-document-actions">
                      <details className="admin-document-preview">
                        <summary>View saved document</summary>
                        {doc.value.startsWith("data:application/pdf") ? (
                          <iframe
                            src={doc.value}
                            title={`${user.name} · ${doc.label}`}
                          />
                        ) : (
                          <img
                            src={doc.value}
                            alt={`${user.name} · ${doc.label}`}
                          />
                        )}
                      </details>
                      <button type="button" onClick={() => doc.set(null)}>
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
          <section
            className="admin-editor-section"
            aria-labelledby="admin-password-title"
          >
            <h3 id="admin-password-title">Password</h3>
            <label className="admin-password-option">
              <input
                type="checkbox"
                checked={changingPassword}
                onChange={(e) => {
                  setChangingPassword(e.target.checked);
                  setPassword("");
                  setConfirm("");
                }}
              />
              Set a new password
            </label>
            {changingPassword ? (
              <div className="admin-editor-grid mt-4">
                {[
                  { label: "New password", value: password, set: setPassword },
                  {
                    label: "Confirm new password",
                    value: confirm,
                    set: setConfirm,
                  },
                ].map((field) => (
                  <label className="field" key={field.label}>
                    {field.label}
                    <div className="relative">
                      <input
                        className="input pr-12"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        maxLength={72}
                        autoComplete="new-password"
                        value={field.value}
                        onChange={(e) => field.set(e.target.value)}
                      />
                      <button
                        type="button"
                        className="password-toggle absolute right-1 top-0 text-[#aa98bc]"
                        aria-label={
                          showPassword
                            ? "Hide new passwords"
                            : "Show new passwords"
                        }
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        <Icon name="eye" size={18} />
                      </button>
                    </div>
                  </label>
                ))}
              </div>
            ) : null}
            <p className="text-xs muted mt-3">
              Changing email, password, role or status signs out the user’s
              existing sessions. The administrator editing their own account
              stays signed in.
            </p>
          </section>
          <p className="admin-editor-metadata">
            Account ID: {user.id}
            <br />
            Created:{" "}
            {new Date(user.created_at).toLocaleString("en-MY", {
              timeZone: "Asia/Kuala_Lumpur",
            })}
          </p>
        </fieldset>
        <Notice message={error} error />
        <div className="admin-editor-footer action-group">
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
            <Icon name="check" size={16} />
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
