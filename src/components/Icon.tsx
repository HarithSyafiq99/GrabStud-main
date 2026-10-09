import type { CSSProperties } from "react";
const paths: Record<string, string> = {
  edit: "M16 3l5 5 M4 20l4-1 13-13a2.8 2.8 0 0 0-4-4L4 15l-1 6 5-2 M12 21h9",
  mail: "M3 5h18v14H3z M3 5l9 7 9-7",
  key: "M15 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M9 11l-6 9h4v-3h3v-3l2-2",
  car: "M5 17H3v-6l2-6h14l2 6v6h-2 M5 17v3 M19 17v3 M3 11h18 M7 14h.01 M17 14h.01 M5 17h14",
  phone:
    "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z",
  search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0 M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  clock: "M12 8v4l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  shield: "M12 22s9-4 9-11V5l-9-3-9 3v6c0 7 9 11 9 11 M8 12l3 3 5-6",
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  history: "M3 11a9 9 0 1 1 2 7 M3 4v7h7 M12 7v5l3 2",
  logout: "M9 21H3V3h6 M9 12h12 M16 7l5 5-5 5",
  menu: "M3 6h18 M3 12h18 M3 18h18",
  close: "M6 6l12 12 M18 6L6 18",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
  check: "M5 12l4 4L19 6",
  plus: "M12 5v14 M5 12h14",
  leaf: "M20 3c0 10-3 17-10 17a7 7 0 0 1 0-14c4 0 8-1 10-3 M4 22L16 10",
  upload: "M12 16V3 M7 8l5-5 5 5 M3 16v5h18v-5",
  file: "M14 2H4v20h16V8z M14 2v6h6 M8 13h8 M8 17h5",
  wallet: "M3 5h16v3H3V5z M3 8h18v13H3z M16 13h5v4h-5z",
  heart: "M20 4c-3-3-6-1-8 1-2-2-5-4-8-1-4 4 0 9 8 16 8-7 12-12 8-16",
  chevron: "M9 5l7 7-7 7",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
};
export function Icon({
  name,
  size = 20,
  className = "",
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      data-icon={name}
    >
      <path d={paths[name] ?? paths.car} />
    </svg>
  );
}
