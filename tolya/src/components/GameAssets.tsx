import { useState } from 'react';

export const TolyaImage = ({ isJumping, direction, isPowered = false }: { isJumping: boolean, direction: 'left' | 'right', isPowered?: boolean }) => {
  const [error, setError] = useState(false);

  if (error) {
    // Fallback SVG if image not found
    return (
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
        <g transform={direction === 'left' ? 'scale(-1, 1) translate(-100, 0)' : ''}>
          <circle cx="50" cy="20" r="15" fill={isPowered ? "#4ade80" : "#ffdbac"} /> {/* Green face if powered */}
          <circle cx="55" cy="18" r="2" fill="#000" />
          <path d="M55 25 Q50 28 45 25" stroke="#000" strokeWidth="2" fill="none" />
          <path d="M35 15 Q50 5 65 15" stroke="#4a3728" strokeWidth="4" fill="none" />
          <rect x="40" y="35" width="20" height="35" rx="5" fill={isPowered ? "#166534" : "#3b82f6"} /> {/* Dark green shirt if powered */}
          <path d={isJumping ? "M40 40 L20 30" : "M40 40 L30 60"} stroke={isPowered ? "#4ade80" : "#ffdbac"} strokeWidth="6" strokeLinecap="round" />
          <path d={isJumping ? "M60 40 L80 20" : "M60 40 L70 60"} stroke={isPowered ? "#4ade80" : "#ffdbac"} strokeWidth="6" strokeLinecap="round" />
          <path d={isJumping ? "M45 70 L30 85" : "M45 70 L40 95"} stroke="#1e3a8a" strokeWidth="6" strokeLinecap="round" />
          <path d={isJumping ? "M55 70 L70 90" : "M55 70 L60 95"} stroke="#1e3a8a" strokeWidth="6" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  return (
    <img
      src={isPowered ? "/assets/tolya2.png" : "/assets/tolya.png"}
      alt="Tolya"
      className={`w-full h-full object-contain ${direction === 'left' ? 'scale-x-[-1]' : ''}`}
      onError={() => setError(true)}
    />
  );
};

export const BedImage = ({ variant = 0, isGiant = false, isMiniboss = false, isMushroom = false }: { variant?: number, isGiant?: boolean, isMiniboss?: boolean, isMushroom?: boolean }) => {
  const [error, setError] = useState(false);

  // Map variants to specific filenames
  const images = [
    '/assets/bed1.png',
    '/assets/bed2.png',
    '/assets/bed3.png'
  ];

  let imageSrc = images[variant % images.length];
  if (isGiant) imageSrc = '/assets/boss.png';
  if (isMiniboss) imageSrc = '/assets/miniboss.png';
  if (isMushroom) imageSrc = '/assets/mush.png';

  if (error) {
    if (isMushroom) {
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle cx="50" cy="50" r="40" fill="#dc2626" />
          <circle cx="30" cy="40" r="10" fill="#fff" />
          <circle cx="70" cy="40" r="10" fill="#fff" />
          <circle cx="50" cy="20" r="10" fill="#fff" />
          <rect x="40" y="50" width="20" height="40" fill="#fef3c7" />
        </svg>
      );
    }
    // Fallback SVG
    const beds = [
      <g key="bed1">
        <rect x="5" y="20" width="90" height="40" rx="2" fill="#8B4513" />
        <rect x="10" y="15" width="80" height="35" fill="#fff" />
        <rect x="10" y="30" width="80" height="20" fill="#3b82f6" opacity="0.5" />
        <rect x="5" y="50" width="5" height="10" fill="#5D4037" />
        <rect x="90" y="50" width="5" height="10" fill="#5D4037" />
      </g>,
      <g key="bed2">
        <path d="M5 15 Q25 5 50 15 Q75 5 95 15 L95 50 L5 50 Z" fill="#b91c1c" />
        <rect x="5" y="25" width="90" height="30" fill="#fecaca" />
        <rect x="5" y="35" width="90" height="20" fill="#991b1b" />
      </g>,
      <g key="bed3">
        <rect x="5" y="25" width="5" height="30" fill="#94a3b8" />
        <rect x="90" y="25" width="5" height="30" fill="#94a3b8" />
        <rect x="10" y="35" width="80" height="15" fill="#fff" />
        <line x1="5" y1="50" x2="95" y2="50" stroke="#475569" strokeWidth="4" />
      </g>
    ];

    return (
      <svg viewBox="0 0 100 60" className="w-full h-full" preserveAspectRatio="none">
        {isGiant && <rect width="100" height="60" fill="rgba(255,0,0,0.2)" />}
        {beds[variant % beds.length]}
      </svg>
    );
  }

  return (
    <img
      src={imageSrc}
      alt={isGiant ? "Boss Bed" : (isMiniboss ? "Miniboss Bed" : "Bed")}
      className="w-full h-full object-fill"
      onError={() => setError(true)}
    />
  );
};

export const TreeObject = ({ type = 0 }: { type?: number }) => {
  const trees = [
    <g key="tree1">
      <rect x="45" y="60" width="10" height="40" fill="#5D4037" />
      <path d="M50 10 L20 60 L80 60 Z" fill="#166534" />
    </g>,
    <g key="tree2">
      <rect x="45" y="50" width="10" height="50" fill="#5D4037" />
      <circle cx="50" cy="40" r="30" fill="#22c55e" />
      <circle cx="40" cy="30" r="10" fill="#4ade80" opacity="0.5" />
    </g>
  ];
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {trees[type % trees.length]}
    </svg>
  );
};

export const WinImage = () => {
  const [error, setError] = useState(false);

  if (error) {
    // Fallback: Tolya lying down happy
    return (
      <div className="relative w-64 h-64">
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl">
          <circle cx="50" cy="50" r="45" fill="#047857" opacity="0.5" />
          <g transform="translate(20, 30) rotate(90, 30, 30)">
            {/* Body */}
            <rect x="25" y="30" width="20" height="35" rx="5" fill="#3b82f6" />
            {/* Head */}
            <circle cx="35" cy="15" r="15" fill="#ffdbac" />
            {/* Smile */}
            <path d="M30 18 Q35 25 40 18" stroke="#000" strokeWidth="2" fill="none" />
          </g>
        </svg>
        <div className="absolute top-0 right-0 animate-bounce text-pink-500">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <img
      src="/assets/win.png"
      alt="Tolya found the hole!"
      className="max-w-md w-full rounded-xl shadow-2xl border-4 border-emerald-300"
      onError={() => setError(true)}
    />
  );
};
