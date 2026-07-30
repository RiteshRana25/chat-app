import { useEffect, useRef, type MouseEvent } from "react";
import { useAuth } from "./AuthContext";

type Petal = {
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
};

const COLORS = ["#ffb7c5", "#ffc9d4", "#ffa6b8", "#ffe0e8", "#ff9aaf", "#ffd6e0", "#ffc2d1"];

function makePetal(
  w: number,
  h: number,
  burst = false,
  origin?: { x: number; y: number }
): Petal {
  const ox = origin?.x ?? Math.random() * w;
  const oy =
    origin?.y ??
    (burst ? 40 + Math.random() * 80 : -20 - Math.random() * 100);
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
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}

function drawPetal(ctx: CanvasRenderingContext2D, p: Petal) {
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

export function BlossomScene({ density = 36, className = "" }: Props) {
  const { t } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const treeRef = useRef<HTMLButtonElement>(null);
  const canopyRef = useRef<HTMLButtonElement>(null);
  const petalsRef = useRef<Petal[]>([]);
  const sizeRef = useRef({ w: 0, h: 0 });
  const rafRef = useRef(0);

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

      if (petalsRef.current.length === 0) {
        petalsRef.current = Array.from({ length: density }, () =>
          makePetal(w, h)
        );
      }
    };

    resize();
    window.addEventListener("resize", resize);

    const tick = () => {
      const { w, h } = sizeRef.current;
      ctx.clearRect(0, 0, w, h);

      for (const p of petalsRef.current) {
        p.swing += p.swingSpeed;
        p.x += p.speedX + Math.sin(p.swing) * 0.55;
        p.y += p.speedY;
        p.rot += p.rotSpeed;
        drawPetal(ctx, p);

        if (p.y > h + 30 || p.x < -40 || p.x > w + 40) {
          Object.assign(p, makePetal(w, h));
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

  function burstAt(x: number, y: number, count = 42) {
    const { w, h } = sizeRef.current;
    const burst = Array.from({ length: count }, () =>
      makePetal(w, h, true, { x, y })
    );
    petalsRef.current.push(...burst);
    if (petalsRef.current.length > 200) {
      petalsRef.current.splice(0, petalsRef.current.length - 200);
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
    <div className={`blossom-scene ${className}`} aria-hidden="true">
      <canvas ref={canvasRef} className="blossom-canvas" />

      <button
        ref={canopyRef}
        type="button"
        className="blossom-canopy"
        aria-label={t.tapBlossomsTitle}
        title={t.tapBlossomsTitle}
        onClick={burstFromCanopy}
      >
        <svg viewBox="0 0 960 120" className="canopy-svg" preserveAspectRatio="none">
          {CANOPY_BLOOMS.map((b, i) => (
            <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill={b.c} opacity={0.92} />
          ))}
          <g fill="#ff8fa8" opacity="0.75">
            <circle cx="95" cy="22" r="5" />
            <circle cx="270" cy="42" r="5" />
            <circle cx="450" cy="20" r="4.5" />
            <circle cx="630" cy="40" r="5" />
            <circle cx="810" cy="20" r="4.5" />
          </g>
        </svg>
        <span className="canopy-hint">{t.tapBlossoms}</span>
      </button>

      <button
        ref={treeRef}
        type="button"
        className="blossom-tree"
        aria-label={t.tapTreeTitle}
        title={t.tapTreeTitle}
        onClick={burstFromTree}
      >
        <svg viewBox="0 0 420 560" className="tree-svg">
          <ellipse cx="210" cy="535" rx="90" ry="14" fill="rgba(16,36,31,0.1)" />

          {/* one thick straight stem */}
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

          {/* blossom crown around the top of the stem */}
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
        <span className="tree-hint">{t.tapTree}</span>
      </button>
    </div>
  );
}
