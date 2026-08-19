import React from 'react';

interface VocabClashLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const VocabClashLogo: React.FC<VocabClashLogoProps> = ({ 
  className = '', 
  size = 'md' 
}) => {
  const sizeMap = {
    sm: 'w-7 h-7',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20'
  };

  const dimension = sizeMap[size] || 'w-10 h-10';

  return (
    <div 
      className={`relative inline-flex items-center justify-center shrink-0 rounded-2xl overflow-hidden shadow-lg border border-indigo-400/40 bg-[#0d0f2b] ${dimension} ${className}`}
      title="VocabClash App Icon"
    >
      <svg 
        viewBox="0 0 512 512" 
        className="w-full h-full object-cover"
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Background Gradients */}
          <radialGradient id="vcBgGrad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#2b1a6d" />
            <stop offset="50%" stopColor="#13103a" />
            <stop offset="100%" stopColor="#08081c" />
          </radialGradient>
          
          {/* Blue Glove Gradient */}
          <linearGradient id="blueGloveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="45%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>

          {/* Purple Glove Gradient */}
          <linearGradient id="purpleGloveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="45%" stopColor="#9333ea" />
            <stop offset="100%" stopColor="#6b21a8" />
          </linearGradient>

          {/* Gold Banner Gradient */}
          <linearGradient id="goldBannerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>

          {/* Spark Lightning Glow */}
          <filter id="lightningGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Rounded Icon Background */}
        <rect width="512" height="512" rx="110" fill="url(#vcBgGrad)" />

        {/* Ambient Top Glows */}
        <circle cx="140" cy="140" r="130" fill="#0284c7" opacity="0.25" filter="blur(30px)" />
        <circle cx="370" cy="140" r="130" fill="#9333ea" opacity="0.25" filter="blur(30px)" />
        <circle cx="256" cy="180" r="90" fill="#fbbf24" opacity="0.3" filter="blur(25px)" />

        {/* Decorative Floating Exam Tiles */}
        {/* Left Book & Tile */}
        <g opacity="0.35">
          <rect x="42" y="80" width="80" height="60" rx="10" stroke="#38bdf8" strokeWidth="4" />
          <line x1="55" y1="98" x2="108" y2="98" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
          <line x1="55" y1="112" x2="96" y2="112" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
        </g>
        
        {/* Right Trophy */}
        <g opacity="0.35" transform="translate(365, 60) scale(0.7)">
          <path d="M40 20 H80 V60 C80 85 65 105 40 105 C15 105 0 85 0 60 V20 H40 Z" stroke="#c084fc" strokeWidth="6" fill="none" />
          <path d="M0 35 C-20 35 -25 55 0 65" stroke="#c084fc" strokeWidth="5" fill="none" />
          <path d="M80 35 C100 35 105 55 80 65" stroke="#c084fc" strokeWidth="5" fill="none" />
          <path d="M30 105 V125 H50 V105" stroke="#c084fc" strokeWidth="6" />
          <rect x="20" y="125" width="40" height="15" rx="3" fill="#c084fc" />
        </g>

        {/* Floating Tile 'W' */}
        <rect x="30" y="200" width="58" height="58" rx="14" fill="#0284c7" stroke="#38bdf8" strokeWidth="3" />
        <text x="59" y="242" fill="#ffffff" fontSize="34" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">W</text>

        {/* Floating Tile '?' */}
        <rect x="424" y="210" width="58" height="58" rx="14" fill="#7c3aed" stroke="#a855f7" strokeWidth="3" />
        <text x="453" y="252" fill="#ffffff" fontSize="36" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">?</text>

        {/* Central Lightning Clash */}
        <g filter="url(#lightningGlow)">
          <polygon points="256,70 278,160 250,175 284,245 238,190 262,175" fill="#fef08a" />
          <polygon points="256,75 272,155 248,168 276,235 242,185 260,172" fill="#ffffff" />
        </g>

        {/* Left Boxing Glove (Blue - Letter 'A') */}
        <g transform="translate(195, 175) rotate(-22) scale(1.05)">
          {/* Glove Body */}
          <ellipse cx="-45" cy="0" rx="65" ry="52" fill="url(#blueGloveGrad)" stroke="#7dd3fc" strokeWidth="6" />
          <ellipse cx="-20" cy="-35" rx="32" ry="24" fill="#0284c7" />
          {/* Glove Wrist Band */}
          <rect x="-115" y="-30" width="30" height="60" rx="8" fill="#0369a1" stroke="#38bdf8" strokeWidth="4" />
          {/* White Letter A */}
          <text x="-45" y="14" fill="#ffffff" fontSize="48" fontWeight="900" textAnchor="middle" fontFamily="sans-serif" filter="drop-shadow(0px 3px 4px rgba(0,0,0,0.5))">A</text>
          {/* Glove Highlight */}
          <path d="M-80 -25 C-60 -45 -20 -40 -10 -25" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" opacity="0.6" fill="none" />
        </g>

        {/* Right Boxing Glove (Purple - Letter 'Z') */}
        <g transform="translate(317, 175) rotate(22) scale(1.05)">
          {/* Glove Body */}
          <ellipse cx="45" cy="0" rx="65" ry="52" fill="url(#purpleGloveGrad)" stroke="#d8b4fe" strokeWidth="6" />
          <ellipse cx="20" cy="-35" rx="32" ry="24" fill="#7e22ce" />
          {/* Glove Wrist Band */}
          <rect x="85" y="-30" width="30" height="60" rx="8" fill="#581c87" stroke="#c084fc" strokeWidth="4" />
          {/* White Letter Z */}
          <text x="45" y="14" fill="#ffffff" fontSize="48" fontWeight="900" textAnchor="middle" fontFamily="sans-serif" filter="drop-shadow(0px 3px 4px rgba(0,0,0,0.5))">Z</text>
          {/* Glove Highlight */}
          <path d="M10 -25 C20 -40 60 -45 80 -25" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" opacity="0.6" fill="none" />
        </g>

        {/* Open White Knowledge Book */}
        <g transform="translate(256, 290)">
          {/* Book Spine Center */}
          <path d="M0,20 C-60,-25 -140,-20 -190,0 C-170,35 -90,32 0,42 C90,32 170,35 190,0 C140,-20 60,-25 0,20 Z" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="3" />
          {/* Book Pages Layer Left */}
          <path d="M0,15 C-50,-20 -130,-15 -175,0 C-160,25 -80,25 0,35 Z" fill="#ffffff" />
          {/* Book Pages Layer Right */}
          <path d="M0,15 C50,-20 130,-15 175,0 C160,25 80,25 0,35 Z" fill="#ffffff" />
          {/* Book Central Crease */}
          <line x1="0" y1="10" x2="0" y2="40" stroke="#64748b" strokeWidth="3" />
        </g>

        {/* VocabClash Brand Text */}
        {/* Shadow / Outline */}
        <text x="256" y="386" fill="#0f172a" fontSize="66" fontWeight="900" textAnchor="middle" fontFamily="sans-serif" letterSpacing="-1">VocabClash</text>
        <text x="256" y="382" fill="#0f172a" fontSize="66" fontWeight="900" textAnchor="middle" fontFamily="sans-serif" letterSpacing="-1">VocabClash</text>
        
        {/* Main 3D Text: Vocab (White) + Clash (Golden Yellow) */}
        <g fontFamily="sans-serif" fontWeight="900" fontSize="64" letterSpacing="-1">
          {/* "Vocab" in White-to-Ice Blue */}
          <text x="80" y="380" fill="#ffffff" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.6))">Vocab</text>
          {/* "Clash" in Rich Gold/Orange */}
          <text x="280" y="380" fill="url(#goldBannerGrad)" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.6))">Clash</text>
        </g>

        {/* Bottom Banner Ribbon: LEARN • PLAY • DOMINATE */}
        <g transform="translate(256, 430)">
          {/* Golden Ribbon Base */}
          <path d="M-175,0 L-160,32 L160,32 L175,0 L145,8 L-145,8 Z" fill="#1e1b4b" stroke="url(#goldBannerGrad)" strokeWidth="4" />
          <rect x="-155" y="4" width="310" height="26" rx="6" fill="#1e1b4b" stroke="#f59e0b" strokeWidth="2" />
          {/* Ribbon Text */}
          <text x="0" y="22" fill="#fef08a" fontSize="15" fontWeight="900" textAnchor="middle" fontFamily="sans-serif" letterSpacing="3">
            LEARN  •  PLAY  •  DOMINATE
          </text>
        </g>
      </svg>
    </div>
  );
};
