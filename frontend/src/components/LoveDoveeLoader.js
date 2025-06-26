import React, { useEffect, useRef, useState } from 'react';

// Provided SVG paths (normalized to same viewBox and point count)
const M_PATH = "M6,20 V4 L12,18 L18,4 V20"; // Provided M
const V_PATH = "M6,4 L12,20 L18,4"; // Provided V
// Classic, balanced heart shape
const HEART_PATH = "M12 21s-6.5-5.5-9-9.5C1.5 7.5 4.5 4 8 4c2 0 3.5 1.5 4 2 0.5-0.5 2-2 4-2 3.5 0 6.5 3.5 5 7.5-2.5 4-9 9.5-9 9.5z";

export default function MVSplash() {
  const mRef = useRef();
  const vRef = useRef();
  const mGroupRef = useRef();
  const vGroupRef = useRef();
  const [showGlow, setShowGlow] = useState(false);

  useEffect(() => {
    // Animate movement in
    if (mGroupRef.current && vGroupRef.current) {
      mGroupRef.current.classList.add('mv-move-in');
      vGroupRef.current.classList.add('mv-move-in');
    }
    // Show pink glow after move-in
    const glowTimeout = setTimeout(() => setShowGlow(true), 700);
    return () => clearTimeout(glowTimeout);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm">
      <div className="flex flex-col items-center justify-center min-h-[200px] w-full">
        <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
          {/* Pink glow behind M and V */}
          <div
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-opacity duration-500`}
            style={{
              width: 150,
              height: 150,
              borderRadius: '50%',
              background: '#fbcfe8',
              opacity: showGlow ? 0.5 : 0,
              filter: 'blur(24px)',
              zIndex: 0,
            }}
          />
          <svg width="120" height="120" viewBox="0 0 24 24" className="block relative z-10" style={{ overflow: 'visible' }}>
            {/* M shape from top */}
            <g ref={mGroupRef} className="mv-m">
              <path
                ref={mRef}
                d={M_PATH}
                fill="none"
                stroke="#ec4899"
                strokeWidth="2.5"
                style={{
                  filter: 'drop-shadow(0 2px 8px #fbcfe8)',
                }}
              />
            </g>
            {/* V shape from bottom */}
            <g ref={vGroupRef} className="mv-v">
              <path
                ref={vRef}
                d={V_PATH}
                fill="none"
                stroke="#f472b6"
                strokeWidth="2.5"
                style={{
                  filter: 'drop-shadow(0 2px 8px #fbcfe8)',
                }}
              />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
} 