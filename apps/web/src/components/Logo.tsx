
import React from 'react';

interface LogoProps {
  width?: string;
  height?: string;
  subtitle?: boolean;
  className?: string;
}

export default function Logo({ width = "120", height = "45", subtitle = true, className = "" }: LogoProps) {
  return (
    <div className={`flex flex-col items-start ${className}`} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <svg width={width} height={height} viewBox="0 0 130 50" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Letra F */}
          <path d="M10 45V15H35V21H18V28H32V34H18V45H10Z" fill="white"/>
          <path d="M14 43V17H33" stroke="#09090f" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.6"/>
          
          {/* Letra i con punto circular grande */}
          <path d="M42 45V23H50V45H42Z" fill="white"/>
          <path d="M46 43V25" stroke="#09090f" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.6"/>
          <circle cx="46" cy="15" r="7" fill="white"/>
          
          {/* Letra m */}
          <path d="M56 45V23H64V26C66 24 69 23 72 23C75 23 78 24 80 26C82 24 85 23 88 23C94 23 97 26 97 32V45H89V32C89 30 88 29 86 29C84 29 82 30 82 32V45H74V32C74 30 73 29 71 29C69 29 67 30 67 32V45H56Z" fill="white"/>
          <path d="M60 43V25M78 43V31M93 43V31" stroke="#09090f" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.6"/>
          
          {/* Pin GPS amarillo colectivo */}
          <path d="M112 40C112 37 109.5 35 107 35C104.5 35 102 37 102 40C102 44 107 48 107 48C107 48 112 44 112 40Z" fill="#FACC15"/>
          <circle cx="107" cy="40" r="2" fill="#09090f"/>
        </svg>
      </div>
        <div style={{ color: '#FACC15', fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.22em', marginTop: '-2px', marginLeft: '12px', opacity: 0.95, textTransform: 'uppercase' }}>
          TRANSPORTE COLECTIVO
        </div>
    </div>
  );
}
