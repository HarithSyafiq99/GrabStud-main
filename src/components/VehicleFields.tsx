"use client";
export type Vehicle = {
  car_colour: string;
  car_type: string;
  car_plate: string;
};
export function VehicleFields({
  value,
  onChange,
  required = true,
}: {
  value: Vehicle;
  onChange: (value: Vehicle) => void;
  required?: boolean;
}) {
  return (
    <fieldset className="vehicle-fields">
      <legend>Your car</legend>
      <p className="text-xs muted mb-3">
        These details help your passenger identify the right car at pickup.
      </p>
      <div className="vehicle-grid">
        <label className="field">
          Car colour
          <input
            className="input"
            required={required}
            maxLength={30}
            placeholder="e.g. White"
            value={value.car_colour}
            onChange={(e) => onChange({ ...value, car_colour: e.target.value })}
          />
        </label>
        <label className="field">
          Car model / type
          <input
            className="input"
            required={required}
            maxLength={60}
            placeholder="e.g. Perodua Myvi"
            value={value.car_type}
            onChange={(e) => onChange({ ...value, car_type: e.target.value })}
          />
        </label>
        <label className="field vehicle-plate">
          Plate number
          <input
            className="input"
            required={required}
            minLength={2}
            maxLength={15}
            pattern="[A-Za-z0-9][A-Za-z0-9 -]{1,14}"
            placeholder="e.g. ABC 1234"
            value={value.car_plate}
            onChange={(e) =>
              onChange({ ...value, car_plate: e.target.value.toUpperCase() })
            }
          />
        </label>
      </div>
    </fieldset>
  );
}
