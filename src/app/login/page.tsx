"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { Brand } from "@/components/Brand";
import { Icon } from "@/components/Icon";
import { Notice } from "@/components/UI";
import { api } from "@/lib/client";
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [show, setShow] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api<{ redirect: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push(data.redirect);
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
          <span className="eyebrow">LET’S GET YOU THERE</span>
          <h2>Welcome back.</h2>
          <p className="muted text-xs leading-6">
            Your next campus journey starts here.
            <br />
            Sign in to your student account.
          </p>
          <label className="field mt-7">
            Email address
            <input
              className="input"
              type="email"
              autoComplete="email"
              required
              placeholder="you@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            Password
            <div className="relative">
              <input
                className="input pr-12"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                aria-label={show ? "Hide password" : "Show password"}
                onClick={() => setShow(!show)}
                className="absolute right-3 top-3 text-[#aa98bc]"
              >
                <Icon name="eye" size={19} />
              </button>
            </div>
          </label>
          <Notice message={error} error />
          <button className="btn btn-primary w-full mt-6" disabled={busy}>
            {busy ? "Signing you in…" : "Sign in"}
            <Icon name="arrow" size={16} />
          </button>
          <p className="auth-foot">
            New around here? <Link href="/register">Join the community</Link>
          </p>
          {process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? (
            <>
              <div className="auth-divider">EXPLORE THE DEMO</div>
              <div className="demo-grid">
                {["passenger", "driver", "admin"].map((role) => (
                  <button
                    type="button"
                    key={role}
                    onClick={() => {
                      setEmail(`${role}@grabstudent.edu`);
                      setPassword(
                        role === "admin" ? "Admin123!" : "Student123!",
                      );
                    }}
                  >
                    <span className="capitalize">{role}</span> →
                  </button>
                ))}
              </div>
              <p className="auth-small">
                Demo accounts are available after running db:demo.
              </p>
            </>
          ) : null}
          <p className="auth-small">
            <Icon name="shield" size={12} className="inline mr-1" /> A verified,
            student-only campus community.
          </p>
        </form>
      </section>
    </div>
  );
}
