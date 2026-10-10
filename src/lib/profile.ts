import { validDocument } from "./documents";
import { imageSize } from "image-size";

export const PASSPORT_PHOTO_ERROR =
  "Use a passport-style PNG, JPEG or WebP portrait: at least 350 × 450 pixels, about 35:45 proportions, and under 300KB after processing. Centre your face against a plain light background.";

/** New photos use a passport portrait; legacy photos remain usable until replaced. */
export function validPassportPhoto(value: unknown): value is string {
  if (!validProfilePhoto(value)) return false;
  try {
    const { width, height, orientation } = imageSize(
      Buffer.from(value.split(",")[1], "base64"),
    );
    const rotated = orientation !== undefined && orientation >= 5;
    const w = rotated ? height : width;
    const h = rotated ? width : height;
    return w >= 350 && h >= 450 && w / h >= 0.7 && w / h <= 0.85;
  } catch {
    return false;
  }
}

export function validProfilePhoto(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 400_000 &&
    value.startsWith("data:image/") &&
    validDocument(value)
  );
}
export function validVehicle(car: {
  car_colour: string;
  car_type: string;
  car_plate: string;
}) {
  return (
    car.car_colour.length > 0 &&
    car.car_colour.length <= 30 &&
    car.car_type.length > 0 &&
    car.car_type.length <= 60 &&
    /^[A-Z0-9][A-Z0-9 -]{1,14}$/.test(car.car_plate)
  );
}
