import { useEffect, useRef, type MouseEvent } from "react";
import { useAuth } from "./AuthContext";

type Particle = {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  swing: number;
  swingSpeed: number;
  rot: number;
  rotSpeed: number;
  opacity: number;
  color: string;
  kind: "petal" | "snow";
};

const PETAL_COLORS = [
  "#ffb7c5",
  "#ffc9d4",
  "#ffa6b8",
  "#ffe0e8",
  "#ff9aaf",
  "#ffd6e0",
  "#ffc2d1",
];

const SNOW_COLORS = [
  "#ffffff",
  "#eef6ff",
  "#dce9f8",
  "#f5fbff",
  "#c9daf0",
  "#e8f1fa",
];

function makeParticle(
  w: number,
  _h: number,
  mode: "petal" | "snow",
  burst = false,
  origin?: { x: number; y: number }
): Particle {
  const ox = origin?.x ?? Math.random() * w;
  const oy =
    origin?.y ??
    (burst ? 40 + Math.random() * 80 : -20 - Math.random() * 100);

  if (mode === "snow") {
    return {
      x: ox + (burst ? (Math.random() - 0.5) * 140 : 0),
      y: oy,
      size: 1.6 + Math.random() * 4.2,
      speedY: burst ? 1.2 + Math.random() * 3.2 : 0.55 + Math.random() * 1.4,
      speedX: burst ? (Math.random() - 0.5) * 3.2 : (Math.random() - 0.5) * 0.55,
      swing: Math.random() * Math.PI * 2,
      swingSpeed: 0.008 + Math.random() * 0.02,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.03,
      opacity: 0.45 + Math.random() * 0.5,
      color: SNOW_COLORS[Math.floor(Math.random() * SNOW_COLORS.length)],
      kind: "snow",
    };
  }

  return {
    x: ox + (burst ? (Math.random() - 0.5) * 120 : 0),
    y: oy,
    size: 7 + Math.random() * 12,
    speedY: burst ? 1 + Math.random() * 2.8 : 0.4 + Math.random() * 1,
    speedX: burst ? (Math.random() - 0.5) * 4 : (Math.random() - 0.5) * 0.8,
    swing: Math.random() * Math.PI * 2,
    swingSpeed: 0.01 + Math.random() * 0.025,
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.045,
    opacity: 0.55 + Math.random() * 0.4,
    color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
    kind: "petal",
  };
}

function drawPetal(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.globalAlpha = p.opacity;
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(p.size * 0.55, -p.size * 0.35, 0, -p.size);
  ctx.quadraticCurveTo(-p.size * 0.55, -p.size * 0.35, 0, 0);
  ctx.fill();
  ctx.restore();
}

function drawSnowflake(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.globalAlpha = p.opacity;

  const r = p.size;
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.4);
  glow.addColorStop(0, "rgba(255,255,255,0.95)");
  glow.addColorStop(0.45, p.color);
  glow.addColorStop(1, "rgba(200,220,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = Math.max(0.6, r * 0.22);
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * -r, Math.sin(a) * -r);
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.stroke();
  }

  ctx.restore();
}

type Props = {
  density?: number;
  className?: string;
};

const CANOPY_BLOOMS = [
  { cx: 40, cy: 36, r: 42, c: "#ffc2d1" },
  { cx: 95, cy: 22, r: 38, c: "#ffb0c4" },
  { cx: 150, cy: 48, r: 44, c: "#ffd6e0" },
  { cx: 210, cy: 18, r: 40, c: "#ffa8bc" },
  { cx: 270, cy: 42, r: 46, c: "#ffc9d4" },
  { cx: 330, cy: 16, r: 36, c: "#ffe0e8" },
  { cx: 390, cy: 38, r: 42, c: "#ffb7c5" },
  { cx: 450, cy: 20, r: 38, c: "#ffd0db" },
  { cx: 510, cy: 46, r: 44, c: "#ffc2d1" },
  { cx: 570, cy: 18, r: 36, c: "#ffb0c4" },
  { cx: 630, cy: 40, r: 42, c: "#ffe0e8" },
  { cx: 690, cy: 22, r: 40, c: "#ffa6b8" },
  { cx: 750, cy: 44, r: 38, c: "#ffc9d4" },
  { cx: 810, cy: 20, r: 42, c: "#ffd6e0" },
  { cx: 870, cy: 42, r: 36, c: "#ffb7c5" },
  { cx: 930, cy: 24, r: 40, c: "#ffc2d1" },
  { cx: 70, cy: 70, r: 28, c: "#ffe0e8" },
  { cx: 180, cy: 78, r: 26, c: "#ffb0c4" },
  { cx: 300, cy: 72, r: 30, c: "#ffd0db" },
  { cx: 420, cy: 80, r: 28, c: "#ffa8bc" },
  { cx: 540, cy: 74, r: 32, c: "#ffc9d4" },
  { cx: 660, cy: 78, r: 26, c: "#ffe0e8" },
  { cx: 780, cy: 72, r: 30, c: "#ffb7c5" },
  { cx: 900, cy: 76, r: 28, c: "#ffd6e0" },
];

const SNOW_CLOUDS = [
  { cx: 60, cy: 48, r: 46 },
  { cx: 120, cy: 36, r: 40 },
  { cx: 190, cy: 52, r: 48 },
  { cx: 270, cy: 30, r: 42 },
  { cx: 350, cy: 46, r: 50 },
  { cx: 430, cy: 28, r: 38 },
  { cx: 510, cy: 50, r: 46 },
  { cx: 590, cy: 34, r: 42 },
  { cx: 670, cy: 48, r: 48 },
  { cx: 750, cy: 30, r: 40 },
  { cx: 830, cy: 46, r: 44 },
  { cx: 910, cy: 34, r: 42 },
  { cx: 100, cy: 78, r: 30 },
  { cx: 280, cy: 82, r: 28 },
  { cx: 470, cy: 76, r: 32 },
  { cx: 660, cy: 80, r: 28 },
  { cx: 850, cy: 74, r: 30 },
];

export function BlossomScene({ density = 36, className = "" }: Props) {
  const { t, theme } = useAuth();
  const isDark = theme === "dark";
  const mode = isDark ? "snow" : "petal";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const treeRef = useRef<HTMLButtonElement>(null);
  const canopyRef = useRef<HTMLButtonElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const sizeRef = useRef({ w: 0, h: 0 });
  const rafRef = useRef(0);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      sizeRef.current = { w, h };
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (particlesRef.current.length === 0) {
        particlesRef.current = Array.from({ length: density }, () =>
          makeParticle(w, h, modeRef.current)
        );
      }
    };

    resize();
    window.addEventListener("resize", resize);

    const tick = () => {
      const { w, h } = sizeRef.current;
      ctx.clearRect(0, 0, w, h);
      const currentMode = modeRef.current;

      for (const p of particlesRef.current) {
        if (p.kind !== currentMode) {
          Object.assign(p, makeParticle(w, h, currentMode));
          p.y = Math.random() * h;
          p.x = Math.random() * w;
        }

        p.swing += p.swingSpeed;
        p.x += p.speedX + Math.sin(p.swing) * (p.kind === "snow" ? 0.7 : 0.55);
        p.y += p.speedY;
        p.rot += p.rotSpeed;

        if (p.kind === "snow") drawSnowflake(ctx, p);
        else drawPetal(ctx, p);

        if (p.y > h + 30 || p.x < -40 || p.x > w + 40) {
          Object.assign(p, makeParticle(w, h, currentMode));
          p.y = -10 - Math.random() * 40;
          p.x = Math.random() * w;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [density]);

  useEffect(() => {
    const { w, h } = sizeRef.current;
    if (!w) return;
    particlesRef.current = Array.from({ length: density }, () =>
      makeParticle(w, h, mode)
    );
  }, [mode, density]);

  function burstAt(x: number, y: number, count = 42) {
    const { w, h } = sizeRef.current;
    const burst = Array.from({ length: count }, () =>
      makeParticle(w, h, modeRef.current, true, { x, y })
    );
    particlesRef.current.push(...burst);
    if (particlesRef.current.length > 220) {
      particlesRef.current.splice(0, particlesRef.current.length - 220);
    }
  }

  function burstFromTree() {
    const tree = treeRef.current;
    if (!tree) return;
    const rect = tree.getBoundingClientRect();
    burstAt(rect.left + rect.width * 0.52, rect.top + rect.height * 0.22, 48);
    tree.classList.remove("shake");
    void tree.offsetWidth;
    tree.classList.add("shake");
  }

  function burstFromCanopy(e: MouseEvent<HTMLButtonElement>) {
    const canopy = canopyRef.current;
    burstAt(e.clientX, e.clientY, 50);
    if (!canopy) return;
    canopy.classList.remove("canopy-pulse");
    void canopy.offsetWidth;
    canopy.classList.add("canopy-pulse");
  }

  return (
    <div
      className={`blossom-scene ${className} ${isDark ? "scene-snow" : "scene-blossom"}`}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="blossom-canvas" />

      <button
        ref={canopyRef}
        type="button"
        className="blossom-canopy"
        aria-label={isDark ? t.tapSnowTitle : t.tapBlossomsTitle}
        title={isDark ? t.tapSnowTitle : t.tapBlossomsTitle}
        onClick={burstFromCanopy}
      >
        {isDark ? (
          <svg
            viewBox="0 0 960 120"
            className="canopy-svg snow-canopy-svg"
            preserveAspectRatio="none"
          >
            {SNOW_CLOUDS.map((b, i) => (
              <circle
                key={i}
                cx={b.cx}
                cy={b.cy}
                r={b.r}
                fill={i % 2 === 0 ? "#9eb6d4" : "#b7c9e0"}
                opacity={0.55}
              />
            ))}
            <g fill="#dce7f5" opacity="0.35">
              <circle cx="210" cy="40" r="22" />
              <circle cx="480" cy="36" r="26" />
              <circle cx="740" cy="42" r="24" />
            </g>
          </svg>
        ) : (
          <svg
            viewBox="0 0 960 120"
            className="canopy-svg"
            preserveAspectRatio="none"
          >
            {CANOPY_BLOOMS.map((b, i) => (
              <circle
                key={i}
                cx={b.cx}
                cy={b.cy}
                r={b.r}
                fill={b.c}
                opacity={0.92}
              />
            ))}
            <g fill="#ff8fa8" opacity="0.75">
              <circle cx="95" cy="22" r="5" />
              <circle cx="270" cy="42" r="5" />
              <circle cx="450" cy="20" r="4.5" />
              <circle cx="630" cy="40" r="5" />
              <circle cx="810" cy="20" r="4.5" />
            </g>
          </svg>
        )}
        <span className="canopy-hint">
          {isDark ? t.tapSnow : t.tapBlossoms}
        </span>
      </button>

      <button
        ref={treeRef}
        type="button"
        className="blossom-tree"
        aria-label={isDark ? t.tapSnowTreeTitle : t.tapTreeTitle}
        title={isDark ? t.tapSnowTreeTitle : t.tapTreeTitle}
        onClick={burstFromTree}
      >
        {isDark ? (
          <svg viewBox="0 0 420 560" className="tree-svg winter-tree-svg">
            <ellipse
              cx="210"
              cy="535"
              rx="110"
              ry="16"
              fill="rgba(180,210,240,0.12)"
            />
            <line
              x1="210"
              y1="530"
              x2="210"
              y2="120"
              stroke="#6d7f96"
              strokeWidth="18"
              strokeLinecap="round"
            />
            <line
              x1="210"
              y1="360"
              x2="120"
              y2="240"
              stroke="#6d7f96"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <line
              x1="210"
              y1="320"
              x2="300"
              y2="210"
              stroke="#6d7f96"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <line
              x1="210"
              y1="250"
              x2="145"
              y2="160"
              stroke="#7f91a8"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <line
              x1="210"
              y1="220"
              x2="280"
              y2="130"
              stroke="#7f91a8"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <line
              x1="120"
              y1="240"
              x2="85"
              y2="190"
              stroke="#8aa0b8"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <line
              x1="300"
              y1="210"
              x2="340"
              y2="160"
              stroke="#8aa0b8"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <g fill="#eef6ff" opacity="0.92">
              <ellipse cx="120" cy="236" rx="18" ry="10" />
              <ellipse cx="300" cy="206" rx="20" ry="11" />
              <ellipse cx="145" cy="156" rx="16" ry="9" />
              <ellipse cx="280" cy="126" rx="18" ry="10" />
              <ellipse cx="210" cy="118" rx="28" ry="14" />
              <ellipse cx="85" cy="188" rx="12" ry="7" />
              <ellipse cx="340" cy="158" rx="13" ry="7" />
              <ellipse cx="210" cy="250" rx="14" ry="7" />
            </g>
            <circle cx="320" cy="70" r="28" fill="#f2f6ff" opacity="0.55" />
            <circle cx="320" cy="70" r="18" fill="#fff" opacity="0.85" />
          </svg>
        ) : (
          <svg viewBox="0 0 420 560" className="tree-svg">
            <ellipse
              cx="210"
              cy="535"
              rx="90"
              ry="14"
              fill="rgba(16,36,31,0.1)"
            />
            <line
              x1="210"
              y1="530"
              x2="210"
              y2="70"
              stroke="#6b4a38"
              strokeWidth="144"
              strokeLinecap="round"
            />
            <line
              x1="210"
              y1="530"
              x2="210"
              y2="70"
              stroke="#8a6148"
              strokeWidth="56"
              strokeLinecap="round"
              opacity="0.4"
            />
            <g className="bloom-cluster">
              <circle cx="210" cy="55" r="58" fill="#ffc2d1" />
              <circle cx="155" cy="70" r="46" fill="#ffb0c4" />
              <circle cx="265" cy="68" r="48" fill="#ffd6e0" />
              <circle cx="120" cy="115" r="40" fill="#ffb7c5" />
              <circle cx="300" cy="112" r="42" fill="#ffc9d4" />
              <circle cx="180" cy="120" r="36" fill="#ffe0e8" />
              <circle cx="240" cy="118" r="34" fill="#ffa8bc" />
              <circle cx="210" cy="145" r="38" fill="#ffd0db" />
              <circle cx="95" cy="160" r="32" fill="#ffc2d1" />
              <circle cx="325" cy="158" r="34" fill="#ffb0c4" />
              <circle cx="150" cy="175" r="28" fill="#ffe0e8" />
              <circle cx="270" cy="172" r="30" fill="#ffd6e0" />
              <circle cx="210" cy="195" r="26" fill="#ffa6b8" />
            </g>
            <g fill="#ff8fa8" opacity="0.85">
              <circle cx="210" cy="55" r="7" />
              <circle cx="155" cy="70" r="5" />
              <circle cx="265" cy="68" r="5.5" />
              <circle cx="120" cy="115" r="4.5" />
              <circle cx="300" cy="112" r="5" />
              <circle cx="210" cy="145" r="4.5" />
            </g>
          </svg>
        )}
        <span className="tree-hint">
          {isDark ? t.tapSnowTree : t.tapTree}
        </span>
      </button>
    </div>
  );
}
