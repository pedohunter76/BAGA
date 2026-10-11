import { useId, useState } from "react";

const regions = {
  left: {
    name: "Left lung",
    text: "The left lung has two lobes and shares space with the heart. This drawing is an illustration, not a scan of your lungs.",
  },
  right: {
    name: "Right lung",
    text: "The right lung has three lobes. Airways branch into smaller tubes that carry air toward the air sacs.",
  },
  airway: {
    name: "Airways",
    text: "The trachea divides into two main bronchi. These airways branch inside the lungs. Cigarette logs cannot measure lung function.",
  },
};
export default function LungModel({
  animation,
  intensity = 30,
  interactive = false,
}: {
  animation: boolean;
  intensity?: number;
  interactive?: boolean;
}) {
  const id = useId().replaceAll(":", "");
  const [region, setRegion] = useState<keyof typeof regions>("airway");
  const activate = (key: keyof typeof regions) =>
    interactive ? () => setRegion(key) : undefined;
  const keydown = (key: keyof typeof regions) =>
    interactive
      ? (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setRegion(key);
          }
        }
      : undefined;
  return (
    <div className="lung-model-wrap">
      <svg
        className={`lung-model ${animation ? "breathing" : ""}`}
        viewBox="0 0 360 330"
        aria-label="Educational lung illustration, not a clinical scan"
        role={interactive ? "group" : "img"}
      >
        <defs>
          <linearGradient id={`${id}-pink`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#dda0a0" />
            <stop offset="0.52" stopColor="#a76779" />
            <stop offset="1" stopColor="#5a3549" />
          </linearGradient>
          <linearGradient id={`${id}-right`} x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d4959b" />
            <stop offset="0.6" stopColor="#a86b7c" />
            <stop offset="1" stopColor="#563143" />
          </linearGradient>
          <radialGradient id={`${id}-glow`}>
            <stop offset="0" stopColor="#aa747c" stopOpacity=".2" />
            <stop offset="1" stopColor="#aa747c" stopOpacity="0" />
          </radialGradient>
          <pattern
            id={`${id}-cells`}
            width="18"
            height="18"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="4" cy="5" r="1.2" fill="#f4c4b7" opacity=".45" />
            <circle cx="13" cy="12" r=".8" fill="#351e2a" opacity=".35" />
            <path
              d="M4 5 13 12 18 3"
              fill="none"
              stroke="#efd6be"
              opacity=".08"
            />
          </pattern>
          <clipPath id={`${id}-clip`}>
            <path d="M157 78C135 48 111 72 89 99 63 131 42 188 44 253 44 275 55 284 75 282 108 279 143 262 151 246 163 219 151 165 158 124Zm46 0c22-30 46-6 68 21 26 32 47 89 45 154 0 22-11 31-31 29-33-3-68-20-76-36-12-27 0-81-7-122Z" />
          </clipPath>
        </defs>
        <ellipse
          cx="180"
          cy="190"
          rx="167"
          ry="145"
          fill={`url(#${id}-glow)`}
        />
        <g
          className={interactive ? "lung-region" : ""}
          role={interactive ? "button" : undefined}
          tabIndex={interactive ? 0 : undefined}
          aria-label={interactive ? "Explore right lung" : undefined}
          onClick={activate("right")}
          onKeyDown={keydown("right")}
        >
          <path
            d="M157 78C135 48 111 72 89 99 63 131 42 188 44 253 44 275 55 284 75 282 108 279 143 262 151 246 163 219 151 165 158 124Z"
            fill={`url(#${id}-pink)`}
            stroke="#daa4a3"
            strokeOpacity=".4"
            strokeWidth="1.5"
          />
          <path
            d="M62 157c33 3 54 23 91 36M45 236c43-11 69-18 107-21"
            fill="none"
            stroke="#523044"
            strokeWidth="2"
            opacity=".7"
          />
        </g>
        <g
          className={interactive ? "lung-region" : ""}
          role={interactive ? "button" : undefined}
          tabIndex={interactive ? 0 : undefined}
          aria-label={interactive ? "Explore left lung" : undefined}
          onClick={activate("left")}
          onKeyDown={keydown("left")}
        >
          <path
            d="M203 78c22-30 46-6 68 21 26 32 47 89 45 154 0 22-11 31-31 29-33-3-68-20-76-36-12-27 0-81-7-122Z"
            fill={`url(#${id}-right)`}
            stroke="#daa4a3"
            strokeOpacity=".4"
            strokeWidth="1.5"
          />
          <path
            d="M213 213c30-17 58-32 91-40"
            fill="none"
            stroke="#523044"
            strokeWidth="2"
            opacity=".7"
          />
        </g>
        <g clipPath={`url(#${id}-clip)`} pointerEvents="none">
          <rect
            x="30"
            y="60"
            width="300"
            height="240"
            fill={`url(#${id}-cells)`}
          />
          <rect
            x="30"
            y="60"
            width="300"
            height="240"
            fill="#28222c"
            opacity={intensity / 350}
          />
          <g fill="none" stroke="#eac2b6" strokeLinecap="round" opacity=".52">
            <path
              d="m168 104-38 37-24 45-22 54m45-99-28-9-20 10m22-8-7-24m13 78 21 30 5 27m-28-47-24-12-14 7m17 46-19-2-10 14m54-46 13-14 6-24m-34 74 21 8 10 12M192 104l38 37 24 45 22 54m-45-99 28-9 20 10m-22-8 7-24m-13 78-21 30-5 27m28-47 24-12 14 7m-17 46 19-2 10 14m-54-46-13-14-6-24m34 74-21 8-10 12"
              strokeWidth="3"
            />
            <path
              d="m99 142-14 12-12-1m47-29 8-16m-30 69-22 12m28 31-13 15m34 9-10 16m139-118 14 12 12-1m-47-29-8-16m30 69 22 12m-28 31 13 15m-34 9 10 16"
              strokeWidth="1.3"
            />
          </g>
        </g>
        <g
          className={interactive ? "lung-region" : ""}
          role={interactive ? "button" : undefined}
          tabIndex={interactive ? 0 : undefined}
          aria-label={interactive ? "Explore airways" : undefined}
          onClick={activate("airway")}
          onKeyDown={keydown("airway")}
        >
          <path
            d="M180 34v61m0-1-26 31m26-31 26 31"
            fill="none"
            stroke="#d0b6a6"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path
            d="M174 45h12m-12 8h12m-12 8h12m-12 8h12m-12 8h12m-12 8h12"
            stroke="#8b7168"
            strokeWidth="2"
            opacity=".7"
          />
        </g>
        <path d="M37 294h286" stroke="currentColor" opacity=".06" />
        <text
          x="180"
          y="316"
          textAnchor="middle"
          fontSize="9"
          letterSpacing="3"
          fill="currentColor"
          opacity=".4"
        >
          ANATOMICAL ILLUSTRATION
        </text>
      </svg>
      {interactive && (
        <div className="anatomy-info">
          <strong>{regions[region].name}</strong>
          <p>{regions[region].text}</p>
        </div>
      )}
    </div>
  );
}
