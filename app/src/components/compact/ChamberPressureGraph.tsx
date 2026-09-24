import React, { useState } from 'react';

interface ChamberPressureGraphProps {
  isDark?: boolean;
}

export const ChamberPressureGraph: React.FC<ChamberPressureGraphProps> = ({ isDark = true }) => {
  const [hoverX, setHoverX] = useState<number | null>(null);

  // SVG dimensions
  const width = 300;
  const height = 150;

  // Exact coordinates matching the screenshot
  // Start dot at bottom-left: x=35, y=130
  // Peak dot at top-right: x=270, y=25
  const startPoint = { x: 35, y: 130 };
  const endPoint = { x: 270, y: 25 };

  // Silhouette path (gas spectrum spike around 58% width)
  const silhouettePath = `
    M 30,140
    L 140,140
    Q 160,138 170,110
    L 175,40
    L 180,105
    Q 185,125 195,125
    L 205,128
    Q 220,135 240,140
    L 285,140
    Z
  `;

  // Orange S-curve path
  const orangeCurvePath = `
    M 35,130
    C 80,126 120,100 160,55
    C 190,20 230,22 270,25
  `;

  // Dotted white guideline from the curve's shoulder to the top-right endpoint
  const dottedGuidePath = `
    M 160,55
    L 270,25
  `;

  return (
    <div className="relative w-full h-full flex items-center justify-center p-1">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full select-none overflow-visible cursor-crosshair"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * width;
          setHoverX(Math.max(35, Math.min(270, x)));
        }}
        onMouseLeave={() => setHoverX(null)}
      >
        {/* Subtle grid lines */}
        <g 
          stroke={isDark ? '#333333' : '#e0e0e5'} 
          strokeWidth="1"
        >
          {/* Horizontal lines */}
          <line x1="25" y1="35" x2="285" y2="35" strokeDasharray="2 3" opacity="0.5" />
          <line x1="25" y1="70" x2="285" y2="70" strokeDasharray="2 3" opacity="0.5" />
          <line x1="25" y1="105" x2="285" y2="105" strokeDasharray="2 3" opacity="0.5" />
          <line x1="25" y1="140" x2="285" y2="140" opacity="0.8" />

          {/* Vertical lines */}
          <line x1="85" y1="20" x2="85" y2="140" strokeDasharray="2 3" opacity="0.5" />
          <line x1="150" y1="20" x2="150" y2="140" strokeDasharray="2 3" opacity="0.5" />
          <line x1="215" y1="20" x2="215" y2="140" strokeDasharray="2 3" opacity="0.5" />
        </g>

        {/* Background dark gas silhouette */}
        <path
          d={silhouettePath}
          fill={isDark ? '#323232' : '#c8c9ce'}
          opacity="0.9"
        />

        {/* Dotted guideline matching screenshot from shoulder to peak */}
        <path
          d={dottedGuidePath}
          fill="none"
          stroke={isDark ? '#888888' : '#777777'}
          strokeWidth="1.2"
          strokeDasharray="3 3"
        />

        {/* Main glowing orange curve */}
        <path
          d={orangeCurvePath}
          fill="none"
          stroke="#ff5500"
          strokeWidth="2.4"
          strokeLinecap="round"
          className="filter drop-shadow-[0_0_4px_rgba(255,85,0,0.5)]"
        />

        {/* Start dot: white center with orange ring */}
        <circle
          cx={startPoint.x}
          cy={startPoint.y}
          r="3"
          fill="#ffffff"
          stroke="#ff5500"
          strokeWidth="1.5"
        />

        {/* End dot: white center with orange ring */}
        <circle
          cx={endPoint.x}
          cy={endPoint.y}
          r="3"
          fill="#ffffff"
          stroke="#ff5500"
          strokeWidth="1.5"
        />

        {/* Interactive hover scrubber */}
        {hoverX !== null && (
          <g>
            <line
              x1={hoverX}
              y1="20"
              x2={hoverX}
              y2="140"
              stroke="#ff5500"
              strokeWidth="1"
              strokeDasharray="2 2"
              opacity="0.8"
            />
            <circle
              cx={hoverX}
              cy={hoverX < 160 ? 130 - (hoverX - 35) * 0.6 : 55 - (hoverX - 160) * 0.27}
              r="3.5"
              fill="#ff5500"
            />
          </g>
        )}
      </svg>

      {hoverX !== null && (
        <div className={`absolute top-1 right-2 px-2 py-0.5 rounded font-mono text-[10px] shadow pointer-events-none ${
          isDark ? 'bg-black/80 text-orange-400' : 'bg-white/90 text-orange-600 border border-zinc-200'
        }`}>
          {((hoverX / 300) * 4.2).toFixed(2)}e-3 mbar
        </div>
      )}
    </div>
  );
};
