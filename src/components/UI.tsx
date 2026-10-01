import { Icon } from "./Icon";
export function Notice({
  message,
  error = false,
}: {
  message: string;
  error?: boolean;
}) {
  return message ? (
    <div
      className={`notice ${error ? "error" : ""}`}
      role={error ? "alert" : "status"}
    >
      <Icon name={error ? "close" : "check"} size={16} />
      {message}
    </div>
  ) : null;
}
export function Empty({
  title,
  text,
  icon = "car",
}: {
  title: string;
  text: string;
  icon?: string;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={25} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function Stats({
  items,
}: {
  items: { label: string; value: string | number; icon: string }[];
}) {
  return (
    <div className="stats stagger">
      {items.map((i) => (
        <div className="panel stat" key={i.label}>
          <span className="stat-icon">
            <Icon name={i.icon} />
          </span>
          <div>
            <strong>{i.value}</strong>
            <p>{i.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
