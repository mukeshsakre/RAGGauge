import React from 'react';
import { soundFx } from '../../utils/haptics';

export type EffortLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'MAX';

interface ArcGaugeKnobProps {
  level: EffortLevel;
  onChange?: (level: EffortLevel) => void;
  size?: number;
  isDark?: boolean;
}

export const ArcGaugeKnob: React.FC<ArcGaugeKnobProps> = ({
  level,
  onChange,
  size = 110,
  isDark = true
}) => {
  const levels: EffortLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'MAX'];
  const currentIndex = levels.indexOf(level);

  // Map levels to angles matching the screenshot:
  // MEDIUM is at ~110 degrees (around 4 o'clock), with arc from 0deg (12 o'clock) to 110deg!
  const angleMap: Record<EffortLevel, { start: number; end: number; rotation: number }> = {
    LOW: { start: 0, end: 55, rotation: 55 },
    MEDIUM: { start: 0, end: 115, rotation: 115 },
    HIGH: { start: 0, end: 180, rotation: 180 },
    MAX: { start: 0, end: 240, rotation: 240 }
  };

  const { start, end, rotation } = angleMap[level] || angleMap.MEDIUM;

  const containerSize = size + 36;
  const cx = containerSize / 2;
  const cy = containerSize / 2;
  const r = size / 2 + 8;

  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    // 0 deg is at 12 o'clock
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians)
    };
  };

  const describeArc = (x: number, y: number, radius: number, startA: number, endA: number) => {
    const startPt = polarToCartesian(x, y, radius, endA);
    const endPt = polarToCartesian(x, y, radius, startA);
    const largeArcFlag = endA - startA <= 180 ? '0' : '1';
    return ['M', startPt.x, startPt.y, 'A', radius, radius, 0, largeArcFlag, 0, endPt.x, endPt.y].join(' ');
  };

  // Full 360 circle or track
  const activeArcPath = describeArc(cx, cy, r, start, end);

  const handleClickNext = () => {
    const nextIdx = (currentIndex + 1) % levels.length;
    soundFx.click('press');
    if (onChange) onChange(levels[nextIdx]);
  };

  return (
    <div 
      className="flex flex-col items-center select-none cursor-pointer" 
      onClick={handleClickNext}
    >
      <div 
        className="relative flex items-center justify-center"
        style={{ width: containerSize, height: containerSize }}
      >
        {/* SVG Arc Meter */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {/* Subtle background track */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={isDark ? '#333333' : '#dcdde1'}
            strokeWidth="3.5"
          />

          {/* Active Glowing Thick Orange Arc */}
          <path
            d={activeArcPath}
            fill="none"
            stroke="#ff5500"
            strokeWidth="5"
            strokeLinecap="round"
            className="filter drop-shadow-[0_0_5px_rgba(255,85,0,0.6)]"
          />
        </svg>

        {/* Dial Body with 3D Industrial Depth */}
        <div
          className="rounded-full relative flex items-center justify-center transition-transform duration-150 ease-out shadow-xl"
          style={{
            width: size,
            height: size,
            transform: `rotate(${rotation}deg)`,
            background: isDark
              ? 'radial-gradient(circle at 45% 40%, #303030 0%, #202020 65%, #151515 100%)'
              : 'radial-gradient(circle at 45% 40%, #ffffff 0%, #e2e4e9 65%, #c8c9ce 100%)',
            boxShadow: isDark
              ? '0 6px 14px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.1), inset 0 -2px 4px rgba(0,0,0,0.8)'
              : '0 4px 10px rgba(0,0,0,0.15), inset 0 1px 2px rgba(255,255,255,0.8), inset 0 -2px 3px rgba(0,0,0,0.15)'
          }}
        >
          {/* Outer groove ring */}
          <div 
            className={`absolute inset-1.5 rounded-full border pointer-events-none ${
              isDark ? 'border-black/40' : 'border-black/10'
            }`} 
          />

          {/* Recessed Center Dish */}
          <div
            className="rounded-full flex items-center justify-center shadow-inner"
            style={{
              width: size * 0.44,
              height: size * 0.44,
              background: isDark
                ? 'radial-gradient(circle at 45% 45%, #222222 0%, #121212 100%)'
                : 'radial-gradient(circle at 45% 45%, #e8e9ee 0%, #ced0d6 100%)',
              boxShadow: isDark
                ? 'inset 0 2px 4px rgba(0,0,0,0.8)'
                : 'inset 0 1px 3px rgba(0,0,0,0.2)'
            }}
          />

          {/* Precision Orange Indicator Notch pointing to current level */}
          <div
            className="absolute top-2 w-1 rounded-full bg-[#ff5500] shadow-[0_0_4px_rgba(255,85,0,0.8)]"
            style={{
              height: size * 0.22,
            }}
          />
        </div>
      </div>
    </div>
  );
};
