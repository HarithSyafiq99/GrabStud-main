import { validDocument } from "./documents";

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
