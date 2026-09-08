
'use client';
import { useEffect, useState } from 'react';
import Logo from './Logo';

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFading(true);
      setTimeout(() => setVisible(false), 800);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: '#09090f',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      opacity: fading ? 0 : 1,
      transition: 'opacity 0.8s ease-in-out',
      pointerEvents: fading ? 'none' : 'all',
    }}>
      <div style={{
        transform: fading ? 'scale(1.1)' : 'scale(1)',
        transition: 'transform 0.8s ease-in-out',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px'
      }}>
        <Logo width="240" height="90" className="animate-pulse" />
        <div style={{
          marginTop: '20px',
          width: '40px',
          height: '2px',
          background: 'var(--accent)',
          borderRadius: '1px',
          animation: 'loadingBar 1.5s infinite ease-in-out'
        }} />
      </div>

      <style jsx>{`
        @keyframes loadingBar {
          0% { width: 0; opacity: 0; }
          50% { width: 60px; opacity: 1; }
          100% { width: 0; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
