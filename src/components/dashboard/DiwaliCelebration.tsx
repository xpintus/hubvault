import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, X } from 'lucide-react';

const SESSION_STORAGE_KEY = 'hubvault_diwali_dismissed';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  decay: number;
  color: string;
  size: number;
  trail: { x: number; y: number }[];
}

interface Rocket {
  x: number;
  y: number;
  targetY: number;
  vx: number;
  vy: number;
  color: string;
  palette: string[];
  trail: { x: number; y: number }[];
}

interface Star {
  x: number;
  y: number;
  size: number;
  baseAlpha: number;
  speed: number;
  phase: number;
  color: string;
}

const FIREWORK_PALETTES = [
  // Royal Festive Gold
  ['#fbbf24', '#f59e0b', '#d97706', '#fef3c7', '#ffffff'],
  // Festive Amber & Crimson
  ['#f97316', '#ea580c', '#ef4444', '#dc2626', '#fef08a'],
  // Sparkling Ruby & Gold
  ['#f43f5e', '#e11d48', '#fbbf24', '#fef3c7'],
  // Celestial Royal Blue & Gold
  ['#38bdf8', '#0ea5e9', '#6366f1', '#fbbf24', '#ffffff'],
  // Prosperity Emerald & Gold
  ['#34d399', '#10b981', '#059669', '#fef08a', '#fbbf24'],
];

/**
 * Traditional Clay Diya SVG with authentic flickering flame,
 * multi-layered golden halo glow and floating embers.
 */
function Diya({ side = 'left' }: { side?: 'left' | 'right' }) {
  const isLeft = side === 'left';
  const flameClass = isLeft ? 'animate-diwali-flame-left' : 'animate-diwali-flame-right';
  const haloClass = isLeft ? 'animate-diwali-halo-left' : 'animate-diwali-halo-right';

  return (
    <div className="relative flex flex-col items-center justify-center shrink-0 select-none">
      {/* Warm Ambient Radial Halo behind Diya */}
      <div
        className={`absolute -top-4 left-1/2 -translate-x-1/2 w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-gradient-to-t from-amber-500/35 via-orange-500/20 to-transparent blur-xl pointer-events-none ${haloClass}`}
      />

      {/* Floating Ember Particles */}
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-14 pointer-events-none overflow-visible">
        <span
          className="absolute left-3 bottom-0 w-1.5 h-1.5 rounded-full bg-amber-300 blur-[0.5px] animate-diwali-ember-1"
          style={{ animationDelay: isLeft ? '0s' : '0.6s' }}
        />
        <span
          className="absolute right-3 bottom-1 w-1 h-1 rounded-full bg-orange-300 blur-[0.5px] animate-diwali-ember-2"
          style={{ animationDelay: isLeft ? '0.8s' : '0.2s' }}
        />
        <span
          className="absolute left-6 bottom-3 w-1.5 h-1.5 rounded-full bg-yellow-200 blur-[0.5px] animate-diwali-ember-3"
          style={{ animationDelay: isLeft ? '1.4s' : '1.1s' }}
        />
      </div>

      <svg
        viewBox="0 0 110 95"
        className="w-16 h-14 sm:w-20 sm:h-18 lg:w-24 lg:h-20 drop-shadow-[0_4px_12px_rgba(245,158,11,0.35)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Terracotta Clay Gradient */}
          <linearGradient id={`clayBase-${side}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ea580c" />
            <stop offset="45%" stopColor="#c2410c" />
            <stop offset="100%" stopColor="#7c2d12" />
          </linearGradient>

          {/* Diya Rim Gold Accent */}
          <linearGradient id={`goldRim-${side}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#d97706" />
            <stop offset="50%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>

          {/* Oil Well Gradient */}
          <linearGradient id={`oilWell-${side}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#78350f" />
            <stop offset="100%" stopColor="#451a03" />
          </linearGradient>

          {/* Realistic Multi-Layered Flame Gradient */}
          <linearGradient id={`flameOuter-${side}`} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="25%" stopColor="#ea580c" />
            <stop offset="55%" stopColor="#f59e0b" />
            <stop offset="85%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>

          {/* Core White/Yellow Flame */}
          <linearGradient id={`flameCore-${side}`} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
            <stop offset="30%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
        </defs>

        {/* Diya Base Shadow */}
        <ellipse cx="55" cy="88" rx="38" ry="5" fill="#050814" opacity="0.6" />

        {/* Clay Body of Diya */}
        <path
          d="M 14 62 C 18 78 35 88 55 88 C 75 88 92 78 96 62 C 85 71 68 74 55 74 C 42 74 25 71 14 62 Z"
          fill={`url(#clayBase-${side})`}
        />

        {/* Inner Clay Oil Well */}
        <ellipse cx="55" cy="62" rx="41" ry="9" fill={`url(#oilWell-${side})`} />

        {/* Golden Embossed Rim */}
        <path
          d="M 14 62 C 25 70 42 73 55 73 C 68 73 85 70 96 62 C 88 65 72 67 55 67 C 38 67 22 65 14 62 Z"
          fill={`url(#goldTrim-${side})`}
        />

        {/* Festive Golden Dots on Rim */}
        <circle cx="28" cy="64.5" r="1.3" fill="#fef08a" />
        <circle cx="41" cy="67" r="1.3" fill="#fef08a" />
        <circle cx="55" cy="67.5" r="1.5" fill="#fef08a" />
        <circle cx="69" cy="67" r="1.3" fill="#fef08a" />
        <circle cx="82" cy="64.5" r="1.3" fill="#fef08a" />

        {/* Cotton Wick */}
        <path d="M 53 62 C 54.5 54 55 48 55 44" stroke="#291307" strokeWidth="2.2" strokeLinecap="round" />

        {/* Animated Realistic Flame Group */}
        <g className={`origin-bottom ${flameClass}`} style={{ transformOrigin: '55px 54px' }}>
          {/* Flame Base Blue Halo */}
          <ellipse cx="55" cy="50" rx="3.5" ry="2" fill="#60a5fa" opacity="0.65" />

          {/* Outer Orange/Red Flame Teardrop */}
          <path
            d="M 55 12 C 45 27 41 38 43 47 C 45 54 49 57 55 57 C 61 57 65 54 67 47 C 69 38 65 27 55 12 Z"
            fill={`url(#flameOuter-${side})`}
          />

          {/* Inner Bright Yellow & Pure White Core */}
          <path
            d="M 55 23 C 49 32 47 40 48 46 C 49 51 52 53 55 53 C 58 53 61 51 62 46 C 63 40 61 32 55 23 Z"
            fill={`url(#flameCore-${side})`}
          />
        </g>
      </svg>
    </div>
  );
}

export default function DiwaliCelebration() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(SESSION_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Close handler with smooth exit transition
  const handleDismiss = () => {
    setIsClosing(true);
    setTimeout(() => {
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
      } catch {
        // storage disabled or unavailable
      }
      setDismissed(true);
    }, 280);
  };

  // Fireworks canvas animation loop
  useEffect(() => {
    if (dismissed) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Accessibility check: reduced motion preference
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animationFrameId: number;
    let width = 0;
    let height = 0;

    const updateCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    updateCanvasSize();
    const resizeObserver = new ResizeObserver(() => updateCanvasSize());
    resizeObserver.observe(canvas);

    // Particles, Rockets, and Ambient Stars
    const particles: Particle[] = [];
    const rockets: Rocket[] = [];
    const stars: Star[] = [];

    // Initialize subtle background twinkling stars / golden dust
    const STAR_COUNT = 30;
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * (width || 800),
        y: Math.random() * (height || 220),
        size: Math.random() * 1.5 + 0.6,
        baseAlpha: Math.random() * 0.5 + 0.25,
        speed: Math.random() * 0.25 + 0.1,
        phase: Math.random() * Math.PI * 2,
        color: Math.random() > 0.4 ? '#fbbf24' : '#fef08a',
      });
    }

    const launchRocket = (startX?: number, targetHeight?: number) => {
      if (width <= 0 || height <= 0) return;
      const x = startX ?? Math.random() * (width * 0.8) + width * 0.1;
      const targetY = targetHeight ?? Math.random() * (height * 0.45) + height * 0.15;
      const palette = FIREWORK_PALETTES[Math.floor(Math.random() * FIREWORK_PALETTES.length)];
      const leadColor = palette[0];

      rockets.push({
        x,
        y: height + 5,
        targetY,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -Math.random() * 2.5 - 6.2,
        color: leadColor,
        palette,
        trail: [],
      });
    };

    const explodeRocket = (x: number, y: number, palette: string[]) => {
      const particleCount = Math.floor(Math.random() * 20) + 36;
      for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.3;
        const speed = Math.random() * 3.8 + 1.2;
        const color = palette[Math.floor(Math.random() * palette.length)];

        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          decay: Math.random() * 0.018 + 0.014,
          color,
          size: Math.random() * 2 + 1.2,
          trail: [],
        });
      }
    };

    // Stagger initial bursts for immediate delight
    let launchTimer: NodeJS.Timeout | null = null;
    let nextLaunchDelay = 350;

    if (!prefersReducedMotion) {
      setTimeout(() => launchRocket(width * 0.25, height * 0.3), 150);
      setTimeout(() => launchRocket(width * 0.75, height * 0.25), 650);

      const scheduleNextRocket = () => {
        launchTimer = setTimeout(() => {
          if (!document.hidden && rockets.length < 3) {
            launchRocket();
          }
          nextLaunchDelay = Math.random() * 1400 + 1200; // 1.2s - 2.6s interval
          scheduleNextRocket();
        }, nextLaunchDelay);
      };
      scheduleNextRocket();
    }

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Throttle when user switches browser tabs
      if (document.hidden) {
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // 1. Draw subtle ambient golden floating stars
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.y -= s.speed;
        s.phase += 0.035;
        if (s.y < -5) {
          s.y = height + 5;
          s.x = Math.random() * width;
        }

        const alpha = s.baseAlpha + Math.sin(s.phase) * 0.2;
        ctx.fillStyle = s.color;
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }

      if (prefersReducedMotion) {
        ctx.globalAlpha = 1;
        return;
      }

      // 2. Update & Draw Rockets
      for (let rIdx = rockets.length - 1; rIdx >= 0; rIdx--) {
        const r = rockets[rIdx];
        r.trail.push({ x: r.x, y: r.y });
        if (r.trail.length > 5) r.trail.shift();

        r.x += r.vx;
        r.y += r.vy;
        r.vy += 0.04; // slight drag

        // Draw ascending golden rocket trail
        ctx.beginPath();
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 1.8;
        ctx.globalAlpha = 0.85;
        for (let t = 0; t < r.trail.length; t++) {
          const pt = r.trail[t];
          if (t === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();

        // Rocket head spark
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 2, 0, Math.PI * 2);
        ctx.fill();

        // Check if rocket reached altitude or apex
        if (r.y <= r.targetY || r.vy >= -0.5) {
          explodeRocket(r.x, r.y, r.palette);
          rockets.splice(rIdx, 1);
        }
      }

      // 3. Update & Draw Exploding Particles
      for (let pIdx = particles.length - 1; pIdx >= 0; pIdx--) {
        const p = particles[pIdx];
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 3) p.trail.shift();

        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.965; // air friction
        p.vy *= 0.965;
        p.vy += 0.055; // gravity
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(pIdx, 1);
          continue;
        }

        // Draw particle tail
        if (p.trail.length > 1) {
          ctx.beginPath();
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size;
          ctx.globalAlpha = p.alpha * 0.55;
          ctx.moveTo(p.trail[0].x, p.trail[0].y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }

        // Draw particle core
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (launchTimer) clearTimeout(launchTimer);
      resizeObserver.disconnect();
    };
  }, [dismissed]);

  if (dismissed) return null;

  return (
    <>
      {/* Scoped CSS animations for organic diya flame flickering & ember float */}
      <style>{`
        @keyframes diwali-flame-left {
          0%, 100% {
            transform: scale(1, 1) rotate(-1deg);
            filter: drop-shadow(0 0 10px rgba(245, 158, 11, 0.9)) drop-shadow(0 0 22px rgba(234, 88, 12, 0.55));
          }
          25% {
            transform: scale(0.94, 1.08) rotate(1.8deg);
            filter: drop-shadow(0 0 14px rgba(251, 191, 36, 1)) drop-shadow(0 0 28px rgba(234, 88, 12, 0.7));
          }
          50% {
            transform: scale(1.05, 0.93) rotate(-2deg);
            filter: drop-shadow(0 0 8px rgba(245, 158, 11, 0.8)) drop-shadow(0 0 18px rgba(234, 88, 12, 0.45));
          }
          75% {
            transform: scale(0.96, 1.05) rotate(1.2deg);
            filter: drop-shadow(0 0 13px rgba(251, 191, 36, 0.95)) drop-shadow(0 0 25px rgba(234, 88, 12, 0.6));
          }
        }

        @keyframes diwali-flame-right {
          0%, 100% {
            transform: scale(1.02, 0.97) rotate(1.5deg);
            filter: drop-shadow(0 0 11px rgba(245, 158, 11, 0.85)) drop-shadow(0 0 24px rgba(234, 88, 12, 0.5));
          }
          30% {
            transform: scale(0.94, 1.06) rotate(-1.5deg);
            filter: drop-shadow(0 0 9px rgba(251, 191, 36, 0.8)) drop-shadow(0 0 20px rgba(234, 88, 12, 0.45));
          }
          60% {
            transform: scale(1.06, 0.94) rotate(2.2deg);
            filter: drop-shadow(0 0 15px rgba(251, 191, 36, 1)) drop-shadow(0 0 30px rgba(234, 88, 12, 0.7));
          }
          85% {
            transform: scale(0.96, 1.04) rotate(-0.5deg);
            filter: drop-shadow(0 0 11px rgba(245, 158, 11, 0.9)) drop-shadow(0 0 22px rgba(234, 88, 12, 0.55));
          }
        }

        @keyframes diwali-halo-left {
          0%, 100% { opacity: 0.55; transform: translate(-50%, 0) scale(1); }
          50% { opacity: 0.9; transform: translate(-50%, 0) scale(1.15); }
        }

        @keyframes diwali-halo-right {
          0%, 100% { opacity: 0.85; transform: translate(-50%, 0) scale(1.12); }
          50% { opacity: 0.5; transform: translate(-50%, 0) scale(0.98); }
        }

        @keyframes diwali-ember-1 {
          0% { transform: translate(0, 0) scale(1); opacity: 0.95; }
          50% { transform: translate(-5px, -18px) scale(0.8); opacity: 0.7; }
          100% { transform: translate(3px, -36px) scale(0); opacity: 0; }
        }

        @keyframes diwali-ember-2 {
          0% { transform: translate(0, 0) scale(1); opacity: 0.9; }
          50% { transform: translate(6px, -20px) scale(0.7); opacity: 0.6; }
          100% { transform: translate(-4px, -40px) scale(0); opacity: 0; }
        }

        @keyframes diwali-ember-3 {
          0% { transform: translate(0, 0) scale(1); opacity: 0.95; }
          50% { transform: translate(-3px, -24px) scale(0.75); opacity: 0.65; }
          100% { transform: translate(5px, -46px) scale(0); opacity: 0; }
        }

        .animate-diwali-flame-left {
          animation: diwali-flame-left 2.1s ease-in-out infinite;
        }
        .animate-diwali-flame-right {
          animation: diwali-flame-right 2.4s ease-in-out infinite;
        }
        .animate-diwali-halo-left {
          animation: diwali-halo-left 2.6s ease-in-out infinite;
        }
        .animate-diwali-halo-right {
          animation: diwali-halo-right 2.9s ease-in-out infinite;
        }
        .animate-diwali-ember-1 {
          animation: diwali-ember-1 1.9s ease-out infinite;
        }
        .animate-diwali-ember-2 {
          animation: diwali-ember-2 2.3s ease-out infinite;
        }
        .animate-diwali-ember-3 {
          animation: diwali-ember-3 2.1s ease-out infinite;
        }
      `}</style>

      {/* Main Celebration Banner Container */}
      <div
        className={`relative overflow-hidden rounded-2xl sm:rounded-3xl border border-amber-500/35 bg-gradient-to-r from-slate-950 via-[#0a1128] to-slate-950 shadow-xl shadow-amber-950/20 text-white transition-all duration-300 ease-in-out ${
          isClosing
            ? 'opacity-0 -translate-y-3 max-h-0 py-0 my-0 overflow-hidden'
            : 'opacity-100 translate-y-0 p-5 sm:p-7 my-1'
        }`}
        role="region"
        aria-label="Happy Diwali Celebration Greeting"
      >
        {/* HTML5 Fireworks Canvas (Positioned strictly in background with pointer-events-none) */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-0"
          aria-hidden="true"
        />

        {/* Decorative Festive Top & Bottom Gold Hairline Dividers */}
        <div className="pointer-events-none absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400/80 to-transparent z-10" />
        <div className="pointer-events-none absolute bottom-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/60 to-transparent z-10" />

        {/* Traditional Corner Gold Ornaments */}
        <div className="pointer-events-none absolute top-2.5 left-2.5 w-4 h-4 border-t-2 border-l-2 border-amber-400/60 rounded-tl z-10" />
        <div className="pointer-events-none absolute top-2.5 right-2.5 w-4 h-4 border-t-2 border-r-2 border-amber-400/60 rounded-tr z-10" />
        <div className="pointer-events-none absolute bottom-2.5 left-2.5 w-4 h-4 border-b-2 border-l-2 border-amber-400/60 rounded-bl z-10" />
        <div className="pointer-events-none absolute bottom-2.5 right-2.5 w-4 h-4 border-b-2 border-r-2 border-amber-400/60 rounded-br z-10" />

        {/* Dismiss (×) Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/70 border border-amber-500/30 text-amber-300/80 hover:text-white hover:bg-slate-800 hover:border-amber-400 transition-all active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400"
          title="Dismiss greeting"
          aria-label="Dismiss Diwali greeting"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Banner Content Layout: Left Diya | Center Greeting | Right Diya */}
        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 max-w-5xl mx-auto px-2">
          {/* Left Diya (Desktop & Tablet) */}
          <div className="order-2 sm:order-1 shrink-0 hidden xs:flex">
            <Diya side="left" />
          </div>

          {/* Center Greeting & Blessings */}
          <div className="order-1 sm:order-2 flex-1 text-center space-y-2 sm:space-y-2.5 min-w-0">
            {/* Top Festive Badge */}
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-400/30 px-3.5 py-0.5 text-[11px] sm:text-xs font-bold tracking-widest text-amber-300 uppercase shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-amber-300 animate-pulse" />
              <span>SHUBH DEEPAVALI</span>
              <Sparkles className="h-3.5 w-3.5 text-amber-300 animate-pulse" />
            </div>

            {/* Mobile Diya inline wrapper for smaller screens */}
            <div className="flex xs:hidden items-center justify-center gap-3 pt-1">
              <Diya side="left" />
              <Diya side="right" />
            </div>

            {/* 1. Main Greeting: 🪔 HAPPY DIWALI 🪔 */}
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-wider uppercase leading-tight select-none">
              <span className="inline-block mr-1 text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]">
                🪔
              </span>
              <span className="bg-gradient-to-r from-amber-200 via-yellow-200 via-amber-100 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_2px_14px_rgba(245,158,11,0.65)] font-serif font-extrabold px-1">
                HAPPY DIWALI
              </span>
              <span className="inline-block ml-1 text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]">
                🪔
              </span>
            </h2>

            {/* 2. Subtitle: Wishing You Happiness, Prosperity & Success */}
            <p className="text-xs sm:text-sm md:text-base font-semibold text-amber-100 tracking-wide drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
              Wishing You Happiness, Prosperity &amp; Success
            </p>

            {/* 3. Small Message: May this Diwali bring light, growth and new beginnings. */}
            <p className="text-[11px] sm:text-xs text-amber-200/85 italic max-w-md mx-auto leading-relaxed drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
              &ldquo;May this Diwali bring light, growth and new beginnings.&rdquo;
            </p>
          </div>

          {/* Right Diya (Desktop & Tablet) */}
          <div className="order-3 shrink-0 hidden xs:flex">
            <Diya side="right" />
          </div>
        </div>
      </div>
    </>
  );
}
