import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import type { BookingRecord, Role } from "./types";

export type ReportBooking = Omit<
  BookingRecord,
  "passenger_photo" | "driver_photo"
>;
export const REPORT_BOOKING_SELECT = `SELECT
  b.id,b.ride_id,b.driver_id,b.passenger_id,b.passenger_count,b.status,
  b.quoted_price,b.payment_method,b.created_at,b.updated_at,b.from_zone,b.to_zone,
  b.departure_at,b.pickup_note,b.pickup_lat,b.pickup_lng,b.destination_lat,
  b.destination_lng,b.arrived_at,b.arrival_acknowledged_at,
  p.name AS passenger_name,p.phone_number AS passenger_phone,
  d.name AS driver_name,d.phone_number AS driver_phone,
  d.car_colour,d.car_type,d.car_plate
  FROM bookings b JOIN users p ON p.id=b.passenger_id
  LEFT JOIN users d ON d.id=b.driver_id`;

const malaysia = new Intl.DateTimeFormat("en-MY", {
  timeZone: "Asia/Kuala_Lumpur",
  dateStyle: "medium",
  timeStyle: "short",
});
const date = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : malaysia.format(parsed);
};
export function bookingMonth(value: string) {
  const local = new Date(new Date(value).getTime() + 8 * 3600000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
}
export function monthLabel(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value + "-01T00:00:00Z"));
}
export function earnedFare(booking: ReportBooking, now: Date) {
  const recorded = booking.arrived_at ?? booking.departure_at;
  return booking.driver_id &&
    Number(booking.quoted_price) > 0 &&
    (booking.status === "completed" ||
      (booking.status === "accepted" && !!booking.arrived_at)) &&
    new Date(recorded).getTime() <= now.getTime()
    ? Number(booking.quoted_price)
    : 0;
}

let fontBytes: Promise<Buffer> | undefined;
export async function createBookingPdf(
  bookings: ReportBooking[],
  options: {
    name: string;
    role: Role;
    month?: string;
    archived?: boolean;
    now?: Date;
    archiveSummary?: { bookings: number; parts: number };
  },
) {
  const now = options.now ?? new Date();
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  fontBytes ??= readFile(
    join(process.cwd(), "public/fonts/NotoSans-Regular.ttf"),
  );
  const font = await document.embedFont(await fontBytes, { subset: true });
  const glyphs = new Set(font.getCharacterSet());
  let escapedGlyphs = false;
  const text = (value: string) =>
    Array.from(value)
      .map((char) => {
        if (char === "\n" || char === "\r" || char === "\t") return " ";
        if (glyphs.has(char.codePointAt(0)!)) return char;
        escapedGlyphs = true;
        return `[U+${char.codePointAt(0)!.toString(16).toUpperCase()}]`;
      })
      .join("");
  const purple = rgb(0.45, 0.3, 0.72),
    ink = rgb(0.2, 0.15, 0.28),
    muted = rgb(0.46, 0.43, 0.53);
  const width = 595.28,
    height = 841.89,
    margin = 42,
    contentWidth = width - margin * 2;
  const wrap = (value: string, size: number) => {
    const lines: string[] = [];
    let line = "";
    for (const char of Array.from(text(value))) {
      if (line && font.widthOfTextAtSize(line + char, size) > contentWidth) {
        const split = line.lastIndexOf(" ");
        if (split > line.length / 2) {
          lines.push(line.slice(0, split));
          line = line.slice(split + 1);
        } else {
          lines.push(line);
          line = "";
        }
      }
      line += char;
    }
    if (line || !lines.length) lines.push(line);
    return lines;
  };
  let page = document.addPage([width, height]),
    y = height - margin;
  const heading = () => {
    page.drawRectangle({
      x: margin,
      y: y - 29,
      width: 30,
      height: 30,
      color: purple,
    });
    page.drawText("GS", {
      x: margin + 5,
      y: y - 20,
      size: 13,
      font,
      color: rgb(1, 1, 1),
    });
    page.drawText("GrabStudent", {
      x: margin + 42,
      y: y - 20,
      size: 20,
      font,
      color: ink,
    });
    y -= 55;
    for (const line of wrap(
      `${options.month ? monthLabel(options.month) : "Recent bookings"} · ${options.role} report`,
      15,
    )) {
      page.drawText(line, { x: margin, y, size: 15, font, color: purple });
      y -= 21;
    }
    y -= 8;
  };
  const newPage = () => {
    page = document.addPage([width, height]);
    y = height - margin;
    heading();
  };
  const paragraph = (value: string, size = 10, color = ink) => {
    for (const line of wrap(value, size)) {
      if (y < 65) newPage();
      page.drawText(line, { x: margin, y, size, font, color });
      y -= size + 6;
    }
  };
  heading();
  paragraph(`Account: ${options.name}`);
  paragraph(
    `Generated: ${date(now.toISOString())} · All times in Malaysia time`,
    9,
    muted,
  );
  const bookingCount = options.archiveSummary?.bookings ?? bookings.length;
  paragraph(
    `${bookingCount} booking${bookingCount === 1 ? "" : "s"} · ${options.archived ? "Saved monthly archive" : "Current booking records"}`,
    10,
    purple,
  );
  const agreed = bookings.reduce(
    (sum, b) =>
      sum +
      (["accepted", "completed"].includes(b.status)
        ? Number(b.quoted_price ?? 0)
        : 0),
    0,
  );
  if (!options.archiveSummary)
    paragraph(
      `Agreed booking fares: RM ${(agreed / 100).toFixed(2)}${options.role === "driver" ? ` · Recorded earnings: RM ${(bookings.reduce((sum, b) => sum + earnedFare(b, now), 0) / 100).toFixed(2)}` : ""}`,
    );
  paragraph(
    "Fares are paid directly to the driver by cash or QR; this report is not a payment receipt.",
    9,
    muted,
  );
  y -= 15;
  if (options.archiveSummary) {
    paragraph(
      `This monthly report combines ${options.archiveSummary.parts} saved report parts, ordered from the newest booking to the oldest.`,
    );
    paragraph(
      "Each part retains its original snapshot and totals. The original PDFs are attached with their exact booking records.",
      10,
      muted,
    );
  }
  if (!bookings.length && !options.archiveSummary)
    paragraph("There are no booking records to report yet.");
  for (const [index, b] of bookings.entries()) {
    if (y < 240) newPage();
    paragraph(`${index + 1}. ${b.from_zone} → ${b.to_zone}`, 12, purple);
    paragraph(`Booking ID: ${b.id}`, 8, muted);
    paragraph(
      `Passenger: ${b.passenger_name ?? "Passenger"} · Driver: ${b.driver_name ?? "Not assigned"}`,
    );
    paragraph(
      `Requested: ${date(b.created_at)} · Departure: ${date(b.departure_at)}`,
      9,
    );
    paragraph(
      `Status: ${b.status === "accepted" ? "Booked" : b.status} · Passengers: ${b.passenger_count} · Payment: ${b.payment_method.toUpperCase()}`,
      9,
    );
    paragraph(
      `Fare: ${b.quoted_price == null ? "Awaiting driver price" : "RM " + (Number(b.quoted_price) / 100).toFixed(2)}`,
      10,
    );
    if (b.arrived_at) paragraph(`Driver arrival: ${date(b.arrived_at)}`, 9);
    if (b.arrival_acknowledged_at)
      paragraph(
        `Passenger acknowledgment: ${date(b.arrival_acknowledged_at)}`,
        9,
      );
    if (b.passenger_phone || b.driver_phone)
      paragraph(
        `Passenger phone: ${b.passenger_phone || "—"} · Driver phone: ${b.driver_phone || "—"}`,
        9,
      );
    if (b.car_plate)
      paragraph(`Vehicle: ${b.car_colour} · ${b.car_type} · ${b.car_plate}`, 9);
    if (b.pickup_note) paragraph(`Pickup remarks: ${b.pickup_note}`, 9);
    if (b.pickup_lat != null && b.pickup_lng != null)
      paragraph(`Pickup pin: ${b.pickup_lat}, ${b.pickup_lng}`, 9);
    if (b.destination_lat != null && b.destination_lng != null)
      paragraph(
        `Destination pin: ${b.destination_lat}, ${b.destination_lng}`,
        9,
      );
    y -= 12;
    if (y > 65)
      page.drawLine({
        start: { x: margin, y },
        end: { x: width - margin, y },
        thickness: 0.5,
        color: rgb(0.89, 0.86, 0.94),
      });
    y -= 22;
  }
  const pages = document.getPages();
  for (const [index, p] of pages.entries()) {
    p.drawText(`GrabStudent · ${index + 1} / ${pages.length}`, {
      x: margin,
      y: 28,
      size: 8,
      font,
      color: muted,
    });
    if (escapedGlyphs)
      p.drawText(
        "Unsupported font characters are preserved as Unicode code points [U+XXXX].",
        { x: margin, y: 43, size: 7, font, color: muted },
      );
  }
  document.setTitle(`GrabStudent ${options.month ?? "recent"} booking report`);
  document.setAuthor("GrabStudent");
  document.setCreationDate(now);
  // Preserve exact text and timestamps in the PDF backup, including font-unsupported characters.
  if (!options.archiveSummary)
    await document.attach(
      new TextEncoder().encode(
        JSON.stringify({
          account: options.name,
          role: options.role,
          month: options.month ?? null,
          generated_at: now.toISOString(),
          bookings,
        }),
      ),
      "booking-records.json",
      {
        mimeType: "application/json",
        description: "Exact booking records for this report",
        creationDate: now,
      },
    );
  return document.save();
}
