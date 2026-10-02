import React from 'react';
// @ts-ignore
import logoUrl from '../assets/ldc_logo.svg';

interface LdcLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'custom' | 'header';
  color?: 'gold' | 'white' | 'dark' | 'burgundy-light' | 'nav-gold';
}

export default function LdcLogo({ className = '', size = 'md', color = 'gold' }: LdcLogoProps) {
  const heightMap = {
    sm: 'h-8 sm:h-10',
    header: 'h-9 sm:h-11',
    md: 'h-14 sm:h-16',
    lg: 'h-20 sm:h-24',
    xl: 'h-28 sm:h-32',
    custom: '',
  };

  const height = heightMap[size] !== undefined ? heightMap[size] : heightMap.md;

  // The official downloaded Wikipedia vector logo is rendered in its classic brand gold fill (#b08e4c).
  // When a different shade is needed, we apply elegant high-performance CSS filters.
  let colorFilter = '';
  if (color === 'white') {
    colorFilter = 'brightness-0 invert';
  } else if (color === 'dark') {
    colorFilter = 'brightness-0 opacity-80';
  }

  // Map logo color prop to correct text color classes for the subtitle
  const colorMap = {
    gold: 'text-[#b08e4c]',
    'nav-gold': 'text-[#D4AF37]',
    white: 'text-white/95',
    dark: 'text-stone-850',
    'burgundy-light': 'text-[#8D1B1B]',
  };
  const textColor = colorMap[color] || 'text-[#b08e4c]';

  // Map logo sizes to correct text sizes & tracking for the subtitle Chinese characters
  const textSizes = {
    sm: 'text-[8px] md:text-[9px] tracking-[0.15em] mt-0.5',
    header: 'text-[9px] md:text-[10px] tracking-[0.18em] mt-0.5',
    md: 'text-[11px] md:text-[12px] tracking-[0.22em] mt-1',
    lg: 'text-[15px] md:text-[16px] tracking-[0.28em] mt-1.5',
    xl: 'text-[19px] md:text-[20px] tracking-[0.32em] mt-2',
    custom: 'text-[10px] tracking-widest mt-1',
  };
  const textSize = textSizes[size] !== undefined ? textSizes[size] : textSizes.md;

  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`} id="ldc-official-logo">
      <img
        src={logoUrl}
        alt="LDC Hotels & Resorts"
        className={`w-auto object-contain transition-all duration-300 ${height} ${colorFilter}`}
        id="ldc-logo-img"
        referrerPolicy="no-referrer"
      />
      <span 
        className={`font-serif font-medium text-center whitespace-nowrap leading-none select-none transition-colors duration-300 ${textColor} ${textSize}`} 
        id="ldc-logo-text"
        style={{ fontFamily: "'Noto Serif TC', serif" }}
      >
        雲 朗 觀 光
      </span>
    </div>
  );
}
