"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { Brand } from "@/components/Brand";
import { Dropzone } from "@/components/Dropzone";
import { Icon } from "@/components/Icon";
import { Notice } from "@/components/UI";
import { api } from "@/lib/client";
export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<"passenger" | "driver">("passenger"),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [student, setStudent] = useState(""),
    [password, setPassword] = useState(""),
    [id, setId] = useState<string | null>(null),
    [license, setLicense] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          role,
          name,
          email,
          student_number: student,
          password,
          student_id_doc: id,
          license_doc: role === "driver" ? license : null,
        }),
      });
      router.push("/pending");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <AuthPanel />
      <section className="auth-form-side">
        <form className="auth-form" onSubmit={submit}>
          <Brand />
          <span className="eyebrow">ONE CAMPUS. MORE POSSIBILITIES.</span>
          <h2>Find your people.</h2>
          <p className="muted text-xs mb-6">
            Create an account. Get verified. Share the journey.
          </p>
          <div className="role-tabs">
            {(["passenger", "driver"] as const).map((r) => (
              <button
                type="button"
                key={r}
                className={role === r ? "active" : ""}
                aria-pressed={role === r}
                onClick={() => setRole(r)}
              >
                <Icon name={r === "driver" ? "car" : "users"} size={16} />
                <span className="capitalize">{r}</span>
              </button>
            ))}
          </div>
          <label className="field">
            Full name
            <input
              className="input"
              required
              maxLength={100}
              autoComplete="name"
              placeholder="Your full name"
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
              autoComplete="email"
              placeholder="you@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="field">
              Student number
              <input
                className="input"
                required
                maxLength={40}
                placeholder="e.g. 2026123456"
                value={student}
                onChange={(e) => setStudent(e.target.value)}
              />
            </label>
            <label className="field">
              Password
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
                placeholder="8+ characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          </div>
          <div className="mt-5 space-y-3">
            <Dropzone label="Student ID" required onFile={setId} />
            {role === "driver" ? (
              <Dropzone label="Driving license" required onFile={setLicense} />
            ) : null}
          </div>
          <p className="text-[10px] muted mt-3 leading-5">
            Your documents are only shown to platform administrators for
            verification.
          </p>
          <Notice message={error} error />
          <button className="btn btn-primary w-full mt-5" disabled={busy}>
            {busy ? "Submitting…" : "Create account"}
            <Icon name="arrow" size={16} />
          </button>
          <p className="auth-foot">
            Already part of the community? <Link href="/login">Sign in</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
