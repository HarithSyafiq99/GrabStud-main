/** Accept only bounded, base64-encoded PNG/JPEG/WebP/PDF documents. */
export function validDocument(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2_100_000) return false;
  const m =
    /^data:(image\/(?:png|jpeg|webp)|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      value,
    );
  if (!m) return false;
  const b = Buffer.from(m[2], "base64");
  if (b.length === 0 || b.length > 1_500_000) return false;
  if (m[1] === "application/pdf")
    return b.subarray(0, 5).toString() === "%PDF-";
  if (m[1] === "image/png")
    return b
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (m[1] === "image/jpeg")
    return b[0] === 255 && b[1] === 216 && b[2] === 255;
  return (
    b.subarray(0, 4).toString() === "RIFF" &&
    b.subarray(8, 12).toString() === "WEBP"
  );
}
