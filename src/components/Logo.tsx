import React from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: number;
}

export default function Logo({ className = "", showText = true, size = 120 }: LogoProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="shieldGradient" x1="40" y1="20" x2="160" y2="180" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00CED1" /> {/* Turquoise */}
            <stop offset="100%" stopColor="#008080" /> {/* Teal */}
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Shield Shape */}
        <path
          d="M100 20C70 20 40 35 40 80C40 130 100 180 100 180C100 180 160 130 160 80C160 35 130 20 100 20Z"
          fill="url(#shieldGradient)"
          stroke="#001F3F"
          strokeWidth="4"
        />

        {/* Compass Star */}
        <path
          d="M100 55L110 90L145 100L110 110L100 145L90 110L55 100L90 90L100 55Z"
          fill="white"
          opacity="0.9"
        />
        <path
          d="M100 75L105 95L125 100L105 105L100 125L95 105L75 100L95 95L100 75Z"
          fill="#001F3F"
        />

        {/* Orbiting Arrow */}
        <path
          d="M140 70C150 85 150 115 140 130"
          stroke="#98FF98"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.8"
        />
        <path
          d="M135 135L145 130L140 120L135 135Z"
          fill="#98FF98"
        />

        {/* Sparkle Highlight */}
        <circle cx="145" cy="55" r="4" fill="#98FF98" filter="url(#glow)" />
        <path d="M145 48V62M138 55H152" stroke="#98FF98" strokeWidth="1" />
      </svg>

      {showText && (
        <div className="mt-4 text-center">
          <h1 className="text-4xl font-black tracking-widest text-blue-950 dark:text-white font-sans">
            AEGIS
          </h1>
          <p className="mt-1 text-[10px] font-bold tracking-[0.2em] text-blue-900 dark:text-emerald-400 uppercase">
            PERSONAL SAFETY NAVIGATION
          </p>
        </div>
      )}
    </div>
  );
}
