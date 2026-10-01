export function CampusScene() {
  return (
    <svg
      viewBox="0 0 640 330"
      className="campus-scene"
      fill="none"
      role="img"
      aria-label="Illustration of a shared car travelling through campus"
    >
      <defs>
        <linearGradient id="sky" x2="1" y2="1">
          <stop stopColor="#f4edff" />
          <stop offset="1" stopColor="#e9e3fc" />
        </linearGradient>
        <linearGradient id="car" x2="1" y2="1">
          <stop stopColor="#9471df" />
          <stop offset="1" stopColor="#6944b4" />
        </linearGradient>
      </defs>
      <rect width="640" height="330" rx="30" fill="url(#sky)" />
      <circle cx="515" cy="75" r="36" fill="#fff6d6" />
      <path d="M0 218Q130 150 280 214T640 205V330H0Z" fill="#d9d8f0" />
      <g stroke="#c7bfdf" strokeWidth="2">
        <path d="M350 191V111h109v80 M340 111l65-38 65 38" fill="#faf7ff" />
        <path d="M367 122v37m21-37v37m25-37v37m23-37v37 M395 191v-24h24v24" />
        <path d="M65 207v-65h98v65" fill="#f8f5ff" />
        <path d="M80 155h16v18H80zm36 0h16v18h-16z M104 207v-22h21v22" />
      </g>
      <g fill="#b6cbb7">
        <path d="M516 208c-59 0-43-74-17-85-8-31 52-32 48 5 35 5 42 79-31 80" />
        <path d="M200 197c-42 0-37-56-14-70 2-24 38-22 41 1 29 8 26 69-27 69" />
      </g>
      <path
        d="M516 168v62 M200 155v73"
        stroke="#8ba992"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M-20 280Q180 240 344 279T690 265"
        stroke="#fff"
        strokeWidth="70"
      />
      <path
        className="road-dashes"
        d="M-20 280Q180 240 344 279T690 265"
        stroke="#d7cee8"
        strokeWidth="3"
        strokeDasharray="16 16"
      />
      <g className="scene-car">
        <ellipse
          cx="327"
          cy="281"
          rx="101"
          ry="10"
          fill="#cfc3e6"
          opacity=".6"
        />
        <path
          d="M245 248l25-43q6-9 19-9h52q11 0 18 9l25 31 29 7q8 2 8 12v18H233v-14q0-10 12-11"
          fill="url(#car)"
        />
        <path d="M275 211h27v30h-42z M312 211h29l24 30h-53z" fill="#e7dcff" />
        <path
          d="M238 257h17 M401 254h14"
          stroke="#fff2bd"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <circle cx="272" cy="273" r="17" fill="#433456" />
        <circle cx="272" cy="273" r="8" fill="#e9e3f5" />
        <circle cx="376" cy="273" r="17" fill="#433456" />
        <circle cx="376" cy="273" r="8" fill="#e9e3f5" />
        <path
          d="M318 248h11"
          stroke="#c2a7f4"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
      <g className="scene-pin">
        <path
          d="M308 91a20 20 0 1 1 40 0c0 16-20 30-20 30s-20-14-20-30"
          fill="#8a63cd"
        />
        <circle cx="328" cy="89" r="7" fill="white" />
      </g>
    </svg>
  );
}
