import { Icon } from "./Icon";
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Icon name="car" size={24} />
      </span>
      <span>
        Grab<span className="brand-light">Student</span>
        <small>GOOD COMPANY. BETTER JOURNEYS.</small>
      </span>
    </div>
  );
}
