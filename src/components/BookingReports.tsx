"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Icon } from "./Icon";
import { DownloadButton } from "./DownloadButton";

type MonthlyReport = {
  month: string;
  role: string;
  booking_count: number;
  created_at: string;
};
function label(month: string) {
  return new Date(month + "-01T00:00:00Z").toLocaleDateString("en-MY", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
export function BookingReports() {
  const [reports, setReports] = useState<MonthlyReport[]>([]),
    [error, setError] = useState(""),
    [retention, setRetention] = useState<"all" | "closed" | null>(null);
  const load = useCallback(async () => {
    try {
      const data = await api<{
        reports: MonthlyReport[];
        retention: "all" | "closed" | null;
      }>("/api/reports/monthly", { feedback: "background" });
      setReports(data.reports);
      setRetention(data.retention);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
    const refresh = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [load]);
  return (
    <section className="panel booking-reports" aria-label="Booking PDF reports">
      <div className="booking-reports-heading">
        <div className="booking-reports-icon">
          <Icon name="file" size={24} />
        </div>
        <div className="booking-reports-intro">
          <h2 className="section-title">Booking reports</h2>
          <p className="section-subtitle">
            Download your recent bookings as a PDF. Saved monthly reports stay
            available here.
          </p>
        </div>
        <DownloadButton
          url="/api/reports/bookings"
          filename="grabstudent-bookings.pdf"
        >
          Download PDF
        </DownloadButton>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-rose-600 mt-3">
          {error}{" "}
          <button type="button" className="text-lilac-deep" onClick={load}>
            Try again
          </button>
        </p>
      ) : null}
      {retention ? (
        <div className="booking-retention-note">
          <Icon name="shield" size={18} />
          <p>
            {retention === "all"
              ? "At month end, bookings—including active orders—are saved as PDFs and cleared from the recent booking list."
              : "At month end, completed, cancelled and rejected bookings are saved as PDFs and cleared from the recent booking list."}{" "}
            Your saved reports and recorded income remain available.
          </p>
        </div>
      ) : null}
      <details className="booking-reports-archive">
        <summary>
          <strong>Monthly PDF archive</strong>
          <span>{reports.length}</span>
          <Icon name="chevron" size={16} className="booking-archive-chevron" />
        </summary>
        {reports.length ? (
          <ul>
            {reports.map((report) => (
              <li key={report.month + report.role}>
                <div>
                  <strong>{label(report.month)}</strong>
                  <p>
                    {report.booking_count} booking
                    {report.booking_count === 1 ? "" : "s"} · {report.role}{" "}
                    report
                  </p>
                </div>
                <DownloadButton
                  url={`/api/reports/monthly?month=${report.month}&role=${report.role}`}
                  filename={`grabstudent-${report.month}-${report.role}.pdf`}
                >
                  Download PDF
                </DownloadButton>
              </li>
            ))}
          </ul>
        ) : (
          <div className="booking-reports-empty">
            <Icon name="file" size={22} />
            <p>
              Your monthly PDFs will appear here after the first monthly
              archive.
            </p>
          </div>
        )}
      </details>
    </section>
  );
}
