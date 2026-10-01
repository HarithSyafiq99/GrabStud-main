import { Brand } from "./Brand";
import { CampusScene } from "./CampusScene";
import { Icon } from "./Icon";
export function AuthPanel() {
  return (
    <aside className="auth-story">
      <Brand />
      <div className="story-content">
        <span className="eyebrow">
          <span className="live-dot" /> MADE FOR YOUR CAMPUS
        </span>
        <h1>
          A little ride.
          <br />A better <em>day.</em>
        </h1>
        <p>
          Share the journey with your campus community.
          <br />
          Less on petrol. More on what matters.
        </p>
        <CampusScene />
        <div className="story-proof">
          <span>
            <Icon name="shield" size={17} /> Student verified
          </span>
          <span>
            <Icon name="wallet" size={17} /> Fair, fixed rates
          </span>
        </div>
      </div>
      <div className="story-footer">
        <span>Built for students, by students.</span>
        <span>One campus. More possibilities.</span>
      </div>
    </aside>
  );
}
