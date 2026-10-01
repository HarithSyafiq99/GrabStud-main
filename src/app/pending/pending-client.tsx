"use client";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Brand } from "@/components/Brand";
import { Icon } from "@/components/Icon";
import { Notice } from "@/components/UI";
import { Dropzone } from "@/components/Dropzone";
import { api } from "@/lib/client";
import type { SessionUser } from "@/lib/types";
export function PendingClient({ user: initial }: { user: SessionUser }) {
  const router = useRouter();
  const [user, setUser] = useState(initial),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [id, setId] = useState<string | null>(null),
    [license, setLicense] = useState<string | null>(null);
  const check = useCallback(
    async (manual = true) => {
      setBusy(true);
      try {
        const d = await api<{ user: SessionUser }>("/api/auth/me");
        setUser(d.user);
        if (d.user.status === "approved") {
          router.push(d.user.role === "driver" ? "/driver" : "/passenger");
          router.refresh();
        } else if (manual) {
          setMessage(
            d.user.status === "rejected"
              ? "Please upload updated documents below."
              : "Your application is still in review. We’ll check again automatically.",
          );
          setError(false);
        }
      } catch (e) {
        setMessage((e as Error).message);
        setError(true);
      } finally {
        setBusy(false);
      }
    },
    [router],
  );
  useEffect(() => {
    const t = setInterval(() => check(false), 15000);
    return () => clearInterval(t);
  }, [check]);
  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
      setError(true);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/auth/resubmit", {
        method: "POST",
        body: JSON.stringify({ student_id_doc: id, license_doc: license }),
      });
      setUser({ ...user, status: "pending" });
      setMessage("Your updated documents have been sent for review.");
      setError(false);
    } catch (e) {
      setMessage((e as Error).message);
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="pending-wrap">
      <div className="panel pending-card">
        <Brand />
        <div className="pending-symbol">
          <Icon
            name={user.status === "rejected" ? "file" : "clock"}
            size={31}
          />
        </div>
        <span className="eyebrow">ONE SMALL STEP TO YOUR NEXT RIDE</span>
        <h1 className="mt-4">
          {user.status === "rejected"
            ? "Let’s try that again."
            : "You’re almost there."}
        </h1>
        <p>
          Hi {user.name.split(" ")[0]}.{" "}
          {user.status === "rejected"
            ? "Your application was declined. Submit clear, updated documents for another review."
            : "Your account is waiting for document verification. An admin will review your application before you can book or post rides."}
        </p>
        <div className="pending-steps">
          <span>
            <Icon name="check" size={12} />
            Account created
          </span>
          <span>
            <Icon name="clock" size={12} />
            Verification
          </span>
          <span>
            <Icon name="car" size={12} />
            Ready to ride
          </span>
        </div>
        <Notice message={message} error={error} />
        {user.status === "rejected" ? (
          <form onSubmit={submit}>
            <Dropzone label="Student ID" required onFile={setId} />
            {user.role === "driver" ? (
              <Dropzone label="Driving license" required onFile={setLicense} />
            ) : null}
            <button className="btn btn-primary w-full mt-3" disabled={busy}>
              Resubmit application
            </button>
          </form>
        ) : (
          <button
            className="btn btn-primary w-full"
            disabled={busy}
            onClick={() => check()}
          >
            {busy ? "Checking…" : "Check my status"}
            <Icon name="arrow" size={15} />
          </button>
        )}
        <button className="btn btn-secondary mt-3 w-full" onClick={logout}>
          Sign out
        </button>
        <p className="auth-small">
          Status refreshes automatically every 15 seconds.
        </p>
      </div>
    </div>
  );
}
