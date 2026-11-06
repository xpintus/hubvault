import React, { useEffect, useRef } from 'react';

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
  isWillow?: boolean;
  gravity?: number;
  friction?: number;
}

interface Rocket {
  x: number;
  y: number;
  targetY: number;
  vx: number;
  vy: number;
  color: string;
  type: 'chrysanthemum' | 'willow' | 'burst' | 'multicolor';
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

const PALETTES = {
  goldChrysanthemum: ['#fbbf24', '#f59e0b', '#d97706', '#fef3c7', '#ffffff'],
  goldenWillow: ['#fef08a', '#fde047', '#eab308', '#ca8a04', '#fef9c3'],
  redOrange: ['#f97316', '#ea580c', '#ef4444', '#dc2626', '#fef08a'],
  royalPurpleBlue: ['#8b5cf6', '#a855f7', '#38bdf8', '#6366f1', '#fbbf24', '#ffffff'],
  emeraldGreen: ['#10b981', '#34d399', '#059669', '#a7f3d0', '#fef08a'],
};

export default function DiwaliHeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animationFrameId: number;
    let width = 1200;
    let height = 700;

    const updateCanvasSize = () => {
      if (!canvas) return;
      const parent = canvas.parentElement;
      const rect = canvas.getBoundingClientRect();
      const rawW = rect.width || (parent ? parent.clientWidth : 0) || window.innerWidth || 1200;
      const rawH = rect.height || (parent ? parent.clientHeight : 0) || 700;

      width = Math.max(rawW, 360);
      height = Math.max(rawH, 400);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    updateCanvasSize();
    const resizeObserver = new ResizeObserver(() => updateCanvasSize());
    resizeObserver.observe(canvas);

    const particles: Particle[] = [];
    const rockets: Rocket[] = [];
    const stars: Star[] = [];

    // Ambient floating golden stardust
    const STAR_COUNT = 45;
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 0.8,
        baseAlpha: Math.random() * 0.45 + 0.25,
        speed: Math.random() * 0.35 + 0.15,
        phase: Math.random() * Math.PI * 2,
        color: Math.random() > 0.35 ? '#fbbf24' : '#fef08a',
      });
    }

    const launchRocket = (customX?: number, customTargetY?: number, forcedType?: Rocket['type']) => {
      if (width <= 0 || height <= 0) return;
      const x = customX ?? Math.random() * (width * 0.8) + width * 0.1;
      const targetY = customTargetY ?? Math.random() * (height * 0.45) + height * 0.12;

      // Select firework type
      const types: Rocket['type'][] = ['chrysanthemum', 'willow', 'burst', 'multicolor'];
      const type = forcedType ?? types[Math.floor(Math.random() * types.length)];

      let palette: string[];
      if (type === 'chrysanthemum') palette = PALETTES.goldChrysanthemum;
      else if (type === 'willow') palette = PALETTES.goldenWillow;
      else if (type === 'burst') palette = Math.random() > 0.5 ? PALETTES.redOrange : PALETTES.emeraldGreen;
      else palette = PALETTES.royalPurpleBlue;

      rockets.push({
        x,
        y: height + 10,
        targetY,
        vx: (Math.random() - 0.5) * 1.6,
        vy: -Math.random() * 2.8 - 7.2,
        color: palette[0],
        type,
        palette,
        trail: [],
      });
    };

    const explodeRocket = (rocket: Rocket) => {
      const { x, y, type, palette } = rocket;

      if (type === 'willow') {
        // Golden willow: heavy weeping downward trails
        const count = Math.floor(Math.random() * 25) + 55;
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.25;
          const speed = Math.random() * 4.5 + 1.2;
          const color = palette[Math.floor(Math.random() * palette.length)];

          particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 0.5,
            alpha: 1,
            decay: Math.random() * 0.012 + 0.008, // lingers longer
            color,
            size: Math.random() * 2.2 + 1.5,
            trail: [],
            isWillow: true,
            gravity: 0.065,
            friction: 0.975,
          });
        }
      } else if (type === 'chrysanthemum') {
        // Large golden chrysanthemum: dense sphere with trailing sparks
        const count = Math.floor(Math.random() * 30) + 70;
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.2;
          const speed = Math.random() * 5.2 + 2.0;
          const color = palette[Math.floor(Math.random() * palette.length)];

          particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            alpha: 1,
            decay: Math.random() * 0.018 + 0.013,
            color,
            size: Math.random() * 2.5 + 1.6,
            trail: [],
            gravity: 0.05,
            friction: 0.965,
          });
        }
      } else {
        // Burst & Multicolor: vivid colorful bursts with sparkling tails
        const count = Math.floor(Math.random() * 25) + 50;
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
          const speed = Math.random() * 4.8 + 1.8;
          const color = palette[Math.floor(Math.random() * palette.length)];

          particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            alpha: 1,
            decay: Math.random() * 0.02 + 0.014,
            color,
            size: Math.random() * 2.4 + 1.4,
            trail: [],
            gravity: 0.055,
            friction: 0.965,
          });
        }
      }
    };

    // Stagger initial grand opening fireworks
    let launchTimer: NodeJS.Timeout | null = null;
    let nextDelay = 350;

    if (!prefersReducedMotion) {
      setTimeout(() => launchRocket(width * 0.2, height * 0.28, 'chrysanthemum'), 80);
      setTimeout(() => launchRocket(width * 0.8, height * 0.25, 'willow'), 380);
      setTimeout(() => launchRocket(width * 0.5, height * 0.18, 'multicolor'), 750);

      const scheduleRockets = () => {
        launchTimer = setTimeout(() => {
          if (!document.hidden && rockets.length < 5) {
            // 30% chance for grand synchronized double launch
            if (Math.random() < 0.3) {
              launchRocket(width * (0.2 + Math.random() * 0.2));
              setTimeout(() => {
                launchRocket(width * (0.6 + Math.random() * 0.2));
              }, 180);
            } else {
              launchRocket();
            }
          }
          nextDelay = Math.random() * 1100 + 900; // 0.9s - 2.0s cadence
          scheduleRockets();
        }, nextDelay);
      };
      scheduleRockets();
    }

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (document.hidden) return;

      ctx.clearRect(0, 0, width, height);

      // 1. Draw ambient floating golden stars
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.y -= s.speed;
        s.phase += 0.035;
        if (s.y < -5) {
          s.y = height + 5;
          s.x = Math.random() * width;
        }

        const alpha = s.baseAlpha + Math.sin(s.phase) * 0.25;
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

      // 2. Rockets: Update & Render
      for (let rIdx = rockets.length - 1; rIdx >= 0; rIdx--) {
        const r = rockets[rIdx];
        r.trail.push({ x: r.x, y: r.y });
        if (r.trail.length > 7) r.trail.shift();

        r.x += r.vx;
        r.y += r.vy;
        r.vy += 0.038;

        // Draw ascending rocket flame trail
        ctx.beginPath();
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 2.4;
        ctx.globalAlpha = 0.9;
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
        ctx.arc(r.x, r.y, 2.8, 0, Math.PI * 2);
        ctx.fill();

        if (r.y <= r.targetY || r.vy >= -0.5) {
          explodeRocket(r);
          rockets.splice(rIdx, 1);
        }
      }

      // 3. Particles: Update & Render
      for (let pIdx = particles.length - 1; pIdx >= 0; pIdx--) {
        const p = particles[pIdx];
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > (p.isWillow ? 7 : 5)) p.trail.shift();

        const friction = p.friction ?? 0.965;
        const gravity = p.gravity ?? 0.055;

        p.x += p.vx;
        p.y += p.vy;
        p.vx *= friction;
        p.vy *= friction;
        p.vy += gravity;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(pIdx, 1);
          continue;
        }

        // Particle trail
        if (p.trail.length > 1) {
          ctx.beginPath();
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size;
          ctx.globalAlpha = p.alpha * 0.65;
          ctx.moveTo(p.trail[0].x, p.trail[0].y);
          for (let t = 1; t < p.trail.length; t++) {
            ctx.lineTo(p.trail[t].x, p.trail[t].y);
          }
          ctx.stroke();
        }

        // Particle head
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
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      aria-hidden="true"
    />
  );
}
