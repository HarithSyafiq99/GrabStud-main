import { Icon } from "./Icon";

export function PassengerCount({ count }: { count: number }) {
  return (
    <span className="passenger-count-badge">
      <Icon name="users" size={15} />
      {count} {count === 1 ? "passenger" : "passengers"}
    </span>
  );
}

export function PassengerCountPicker({
  count,
  onChange,
  disabled,
}: {
  count: number;
  onChange: (count: number) => void;
  disabled: boolean;
}) {
  return (
    <fieldset
      className="passenger-count-field col-span-full"
      disabled={disabled}
    >
      <legend>Number of passengers</legend>
      <p>Include yourself and everyone travelling with you.</p>
      <div className="passenger-count-options">
        {[1, 2, 3, 4].map((value) => (
          <label key={value}>
            <input
              className="sr-only"
              type="radio"
              name="passenger_count"
              value={value}
              checked={count === value}
              onChange={() => onChange(value)}
            />
            <span>
              <strong>{value}</strong>
              <small>{value === 1 ? "Passenger" : "Passengers"}</small>
            </span>
          </label>
        ))}
      </div>
      <p className="passenger-count-summary" role="status" aria-live="polite">
        <Icon name="users" size={15} />
        Your driver will pick up {count} {count === 1 ? "person" : "people"}.
      </p>
    </fieldset>
  );
}
