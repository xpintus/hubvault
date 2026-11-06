import React from 'react';

export function FestiveStyles() {
  return (
    <style>{`
      @keyframes festive-flame-left {
        0%, 100% { transform: scale(1) rotate(0deg) skewX(0deg); opacity: 0.96; }
        25% { transform: scale(1.06, 0.94) rotate(-3.5deg) skewX(-2.5deg); opacity: 1; }
        50% { transform: scale(0.96, 1.05) rotate(2deg) skewX(1.5deg); opacity: 0.94; }
        75% { transform: scale(1.04, 0.97) rotate(-1.5deg) skewX(-1deg); opacity: 0.98; }
      }
      @keyframes festive-flame-right {
        0%, 100% { transform: scale(1) rotate(0deg) skewX(0deg); opacity: 0.96; }
        25% { transform: scale(1.05, 0.95) rotate(3deg) skewX(2deg); opacity: 1; }
        50% { transform: scale(0.95, 1.04) rotate(-2.5deg) skewX(-1.5deg); opacity: 0.93; }
        75% { transform: scale(1.03, 0.98) rotate(1.5deg) skewX(1deg); opacity: 0.98; }
      }
      @keyframes festive-halo-left {
        0%, 100% { transform: translate(-50%, 0) scale(1); opacity: 0.75; }
        50% { transform: translate(-50%, -4px) scale(1.15); opacity: 1; }
      }
      @keyframes festive-halo-right {
        0%, 100% { transform: translate(-50%, 0) scale(1); opacity: 0.75; }
        50% { transform: translate(-50%, -3px) scale(1.12); opacity: 0.95; }
      }
      @keyframes festive-ember-1 {
        0% { transform: translate(0, 0) scale(1); opacity: 1; }
        50% { transform: translate(-5px, -18px) scale(0.8); opacity: 0.7; }
        100% { transform: translate(4px, -36px) scale(0); opacity: 0; }
      }
      @keyframes festive-ember-2 {
        0% { transform: translate(0, 0) scale(1); opacity: 0.9; }
        50% { transform: translate(6px, -20px) scale(0.7); opacity: 0.6; }
        100% { transform: translate(-4px, -40px) scale(0); opacity: 0; }
      }
      @keyframes festive-ember-3 {
        0% { transform: translate(0, 0) scale(1); opacity: 0.95; }
        50% { transform: translate(-3px, -24px) scale(0.75); opacity: 0.65; }
        100% { transform: translate(5px, -46px) scale(0); opacity: 0; }
      }
      @keyframes festive-lantern-float {
        0%, 100% { transform: translateY(0px) rotate(-1.5deg); }
        50% { transform: translateY(-14px) rotate(1.5deg); }
      }
      @keyframes festive-gold-shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      .animate-festive-flame-left {
        animation: festive-flame-left 2.1s ease-in-out infinite;
      }
      .animate-festive-flame-right {
        animation: festive-flame-right 2.4s ease-in-out infinite;
      }
      .animate-festive-halo-left {
        animation: festive-halo-left 2.6s ease-in-out infinite;
      }
      .animate-festive-halo-right {
        animation: festive-halo-right 2.9s ease-in-out infinite;
      }
      .animate-festive-ember-1 {
        animation: festive-ember-1 1.9s ease-out infinite;
      }
      .animate-festive-ember-2 {
        animation: festive-ember-2 2.3s ease-out infinite;
      }
      .animate-festive-ember-3 {
        animation: festive-ember-3 2.1s ease-out infinite;
      }
      .animate-festive-lantern {
        animation: festive-lantern-float 5s ease-in-out infinite;
      }
      .animate-gold-shimmer {
        background-size: 200% auto;
        animation: festive-gold-shimmer 6s linear infinite;
      }
    `}</style>
  );
}

/**
 * Traditional Indian Clay Diya with multi-layer flickering flame and ambient halo
 */
export function HeroDiya({ side = 'left', size = 'lg' }: { side?: 'left' | 'right'; size?: 'sm' | 'md' | 'lg' }) {
  const isLeft = side === 'left';
  const flameClass = isLeft ? 'animate-festive-flame-left' : 'animate-festive-flame-right';
  const haloClass = isLeft ? 'animate-festive-halo-left' : 'animate-festive-halo-right';

  const sizeClass =
    size === 'lg'
      ? 'w-20 h-16 sm:w-28 sm:h-24 lg:w-36 lg:h-28'
      : size === 'md'
      ? 'w-16 h-14 sm:w-20 sm:h-18'
      : 'w-12 h-10 sm:w-14 sm:h-12';

  return (
    <div className="relative flex flex-col items-center justify-center shrink-0 select-none">
      <FestiveStyles />
      {/* Warm Ambient Pulsing Halo */}
      <div
        className={`absolute -top-6 left-1/2 -translate-x-1/2 w-28 h-28 sm:w-36 sm:h-36 lg:w-44 lg:h-44 rounded-full bg-gradient-to-t from-amber-500/40 via-orange-500/30 to-transparent blur-2xl pointer-events-none ${haloClass}`}
      />

      {/* Floating Spark Embers */}
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-16 h-16 pointer-events-none overflow-visible">
        <span
          className="absolute left-4 bottom-0 w-1.5 h-1.5 rounded-full bg-amber-300 blur-[0.5px] animate-festive-ember-1"
          style={{ animationDelay: isLeft ? '0s' : '0.7s' }}
        />
        <span
          className="absolute right-4 bottom-1 w-1.5 h-1.5 rounded-full bg-orange-300 blur-[0.5px] animate-festive-ember-2"
          style={{ animationDelay: isLeft ? '0.9s' : '0.3s' }}
        />
        <span
          className="absolute left-7 bottom-4 w-1.5 h-1.5 rounded-full bg-yellow-200 blur-[0.5px] animate-festive-ember-3"
          style={{ animationDelay: isLeft ? '1.5s' : '1.1s' }}
        />
      </div>

      <svg
        viewBox="0 0 110 95"
        className={`${sizeClass} drop-shadow-[0_6px_20px_rgba(245,158,11,0.55)]`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`heroClay-${side}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ea580c" />
            <stop offset="45%" stopColor="#c2410c" />
            <stop offset="100%" stopColor="#7c2d12" />
          </linearGradient>

          <linearGradient id={`heroGoldRim-${side}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#d97706" />
            <stop offset="50%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>

          <linearGradient id={`heroOilWell-${side}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#78350f" />
            <stop offset="100%" stopColor="#451a03" />
          </linearGradient>

          <linearGradient id={`heroFlameOuter-${side}`} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="25%" stopColor="#ea580c" />
            <stop offset="55%" stopColor="#f59e0b" />
            <stop offset="85%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>

          <linearGradient id={`heroFlameCore-${side}`} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
            <stop offset="30%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
        </defs>

        {/* Diya Base Shadow */}
        <ellipse cx="55" cy="88" rx="38" ry="5" fill="#030614" opacity="0.65" />

        {/* Terracotta Body */}
        <path
          d="M 14 62 C 18 78 35 88 55 88 C 75 88 92 78 96 62 C 85 71 68 74 55 74 C 42 74 25 71 14 62 Z"
          fill={`url(#heroClay-${side})`}
        />

        {/* Inner Oil Well */}
        <ellipse cx="55" cy="62" rx="41" ry="9" fill={`url(#heroOilWell-${side})`} />

        {/* Golden Embossed Rim */}
        <path
          d="M 14 62 C 25 70 42 73 55 73 C 68 73 85 70 96 62 C 88 65 72 67 55 67 C 38 67 22 65 14 62 Z"
          fill={`url(#heroGoldRim-${side})`}
        />

        {/* Golden Beads */}
        <circle cx="28" cy="64.5" r="1.4" fill="#fef08a" />
        <circle cx="41" cy="67" r="1.4" fill="#fef08a" />
        <circle cx="55" cy="67.5" r="1.6" fill="#fef08a" />
        <circle cx="69" cy="67" r="1.4" fill="#fef08a" />
        <circle cx="82" cy="64.5" r="1.4" fill="#fef08a" />

        {/* Cotton Wick */}
        <path d="M 53 62 C 54.5 54 55 48 55 44" stroke="#291307" strokeWidth="2.4" strokeLinecap="round" />

        {/* Animated Multi-layered Flame */}
        <g className={`origin-bottom ${flameClass}`} style={{ transformOrigin: '55px 54px' }}>
          <ellipse cx="55" cy="50" rx="4" ry="2.2" fill="#60a5fa" opacity="0.75" />
          <path
            d="M 55 10 C 44 26 40 37 42 47 C 44 54 49 57 55 57 C 61 57 66 54 68 47 C 70 37 66 26 55 10 Z"
            fill={`url(#heroFlameOuter-${side})`}
          />
          <path
            d="M 55 22 C 48 31 46 39 47 46 C 48 51 51 53 55 53 C 59 53 62 51 63 46 C 64 39 62 31 55 22 Z"
            fill={`url(#heroFlameCore-${side})`}
          />
        </g>
      </svg>
    </div>
  );
}

/**
 * Traditional Indian Marigold Toran Garland (Genda Phool) along top borders
 */
export function MarigoldToran() {
  return (
    <div className="pointer-events-none absolute top-0 inset-x-0 w-full overflow-hidden select-none z-20 opacity-90">
      <svg
        viewBox="0 0 1200 60"
        preserveAspectRatio="none"
        className="w-full h-10 sm:h-14"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="gendaYellow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#d97706" />
          </radialGradient>
          <radialGradient id="gendaOrange" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fed7aa" />
            <stop offset="45%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#c2410c" />
          </radialGradient>
          <linearGradient id="mangoLeaf" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#14532d" />
          </linearGradient>
        </defs>

        {/* Swag Rope String */}
        <path
          d="M 0,8 Q 150,38 300,8 Q 450,38 600,8 Q 750,38 900,8 Q 1050,38 1200,8"
          stroke="#ca8a04"
          strokeWidth="2.5"
          strokeDasharray="4 2"
        />

        {/* Repeating Garlands: Mango Leaves & Marigold Flowers */}
        {Array.from({ length: 25 }).map((_, i) => {
          const x = i * 48 + 24;
          const curveY = 8 + 20 * Math.sin(((x % 300) / 300) * Math.PI);
          const isOrange = i % 2 === 0;

          return (
            <g key={i} transform={`translate(${x}, ${curveY})`}>
              {/* Mango Leaf */}
              <path d="M 0,-6 Q 8,14 0,26 Q -8,14 0,-6 Z" fill="url(#mangoLeaf)" />
              {/* Marigold Bloom */}
              <circle cx="0" cy="0" r="8" fill={isOrange ? 'url(#gendaOrange)' : 'url(#gendaYellow)'} />
              <circle cx="0" cy="0" r="4" fill="#fef9c3" opacity="0.6" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Traditional Indian Floating Sky Lantern (Kandil / Akash Kandil)
 */
export function SkyLantern({
  className = '',
  style = {},
  color = 'gold',
}: {
  className?: string;
  style?: React.CSSProperties;
  color?: 'gold' | 'amber' | 'crimson' | 'purple';
}) {
  const gradientId = `kandilGrad-${color}`;
  const startColor =
    color === 'gold' ? '#fef08a' : color === 'amber' ? '#fed7aa' : color === 'crimson' ? '#fca5a5' : '#e9d5ff';
  const midColor =
    color === 'gold' ? '#f59e0b' : color === 'amber' ? '#f97316' : color === 'crimson' ? '#ef4444' : '#a855f7';
  const darkColor =
    color === 'gold' ? '#b45309' : color === 'amber' ? '#c2410c' : color === 'crimson' ? '#991b1b' : '#6b21a8';

  return (
    <div className={`pointer-events-none select-none ${className}`} style={style}>
      <svg viewBox="0 0 70 120" className="w-12 h-20 sm:w-16 sm:h-28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={startColor} />
            <stop offset="50%" stopColor={midColor} />
            <stop offset="100%" stopColor={darkColor} />
          </linearGradient>
        </defs>

        {/* Hanging Golden String */}
        <line x1="35" y1="0" x2="35" y2="20" stroke="#fbbf24" strokeWidth="1.5" />

        {/* Lantern Core Prism Body */}
        <polygon points="35,20 60,45 35,70 10,45" fill={`url(#${gradientId})`} opacity="0.95" />
        <polygon points="35,26 52,45 35,64 18,45" fill="#fef08a" opacity="0.85" />

        {/* Interior Candle Light Glow */}
        <circle cx="35" cy="45" r="9" fill="#ffffff" opacity="0.9" filter="drop-shadow(0 0 8px #f59e0b)" />

        {/* Bottom Hanging Golden Tassels */}
        <line x1="35" y1="70" x2="35" y2="110" stroke="#f59e0b" strokeWidth="1.8" />
        <line x1="28" y1="67" x2="22" y2="100" stroke="#fbbf24" strokeWidth="1.4" />
        <line x1="42" y1="67" x2="48" y2="100" stroke="#fbbf24" strokeWidth="1.4" />
      </svg>
    </div>
  );
}

/**
 * Traditional Indian Rangoli Mandala Background Watermark
 */
export function RangoliMandala({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={`pointer-events-none select-none opacity-20 ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="100" cy="100" r="90" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx="100" cy="100" r="70" stroke="#f59e0b" strokeWidth="1.2" />
      <circle cx="100" cy="100" r="50" stroke="#d97706" strokeWidth="1" />
      <circle cx="100" cy="100" r="30" stroke="#fbbf24" strokeWidth="1.2" />
      {/* 8 Floral Petals */}
      {Array.from({ length: 8 }).map((_, i) => (
        <g key={i} transform={`rotate(${i * 45} 100 100)`}>
          <path d="M 100 10 Q 115 50 100 90 Q 85 50 100 10 Z" fill="#f59e0b" fillOpacity="0.25" stroke="#fbbf24" strokeWidth="1" />
          <circle cx="100" cy="20" r="3" fill="#fef08a" />
        </g>
      ))}
      <circle cx="100" cy="100" r="10" fill="#fef08a" fillOpacity="0.6" />
    </svg>
  );
}

/**
 * Hanging Decorative String Fairy Lights
 */
export function HangingFairyLights() {
  return (
    <div className="pointer-events-none absolute top-0 inset-x-0 w-full overflow-hidden select-none z-10 opacity-80">
      <div className="flex justify-around items-start w-full px-4">
        {Array.from({ length: 16 }).map((_, i) => {
          const dropHeight = (i % 4) * 8 + 12;
          const colors = ['#fde047', '#fb923c', '#f43f5e', '#38bdf8', '#4ade80'];
          const lightColor = colors[i % colors.length];
          const delay = `${(i * 0.25) % 2}s`;

          return (
            <div key={i} className="flex flex-col items-center">
              <div className="w-[1px] bg-amber-400/50" style={{ height: `${dropHeight}px` }} />
              <div
                className="w-2.5 h-3.5 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.85)] animate-pulse"
                style={{ backgroundColor: lightColor, animationDelay: delay, animationDuration: '1.8s' }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
