import React, { useState, useRef } from 'react';
import { soundFx } from '../../utils/haptics';

interface RotaryKnobProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  size?: number; // size in pixels
  onChange?: (val: number) => void;
  tickCount?: number;
  isDark?: boolean;
}

export const RotaryKnob: React.FC<RotaryKnobProps> = ({
  value,
  min = 0,
  max = 1200,
  step = 10,
  size = 110,
  onChange,
  tickCount = 27,
  isDark = true
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef<number>(0);
  const startValRef = useRef<number>(value);
  const lastSoundValRef = useRef<number>(value);

  // Map value to rotation angle: -135deg to +135deg (total 270 degrees sweep)
  const range = max - min;
  const clampedVal = Math.min(max, Math.max(min, value));
  const fraction = range > 0 ? (clampedVal - min) / range : 0;
  const currentAngle = -135 + fraction * 270;

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    startYRef.current = e.clientY;
    startValRef.current = clampedVal;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    soundFx.click('press');
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaY = startYRef.current - e.clientY;
    const valueDelta = (deltaY / 160) * range;
    let nextVal = Math.round((startValRef.current + valueDelta) / step) * step;
    nextVal = Math.min(max, Math.max(min, nextVal));

    if (nextVal !== value && onChange) {
      if (Math.abs(nextVal - lastSoundValRef.current) >= (step * 2 || 10)) {
        soundFx.click('knob');
        lastSoundValRef.current = nextVal;
      }
      onChange(nextVal);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      soundFx.click('release');
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const dir = e.deltaY < 0 ? 1 : -1;
    let nextVal = Math.round((clampedVal + dir * step) / step) * step;
    nextVal = Math.min(max, Math.max(min, nextVal));
    if (nextVal !== value && onChange) {
      soundFx.click('knob');
      onChange(nextVal);
    }
  };

  // Generate tick marks around the perimeter
  const ticks = [];
  for (let i = 0; i < tickCount; i++) {
    const tickFrac = i / (tickCount - 1);
    const angle = -135 + tickFrac * 270;
    const isPastCurrent = tickFrac <= fraction;
    ticks.push({ 
      angle, 
      isPastCurrent, 
      isMajor: i === 0 || i === tickCount - 1 || i % 6 === 0 
    });
  }

  const containerSize = size + 36;
  const cx = containerSize / 2;
  const cy = containerSize / 2;
  const rInner = size / 2 + 3;
  const rOuter = size / 2 + 10;

  return (
    <div 
      className="flex flex-col items-center select-none" 
      onWheel={handleWheel}
    >
      <div 
        className="relative flex items-center justify-center cursor-ns-resize touch-none"
        style={{ width: containerSize, height: containerSize }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Radial Tick Marks */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {ticks.map((t, idx) => {
            const rad = (t.angle - 90) * (Math.PI / 180);
            const x1 = cx + rInner * Math.cos(rad);
            const y1 = cy + rInner * Math.sin(rad);
            const x2 = cx + (t.isMajor ? rOuter + 2 : rOuter) * Math.cos(rad);
            const y2 = cy + (t.isMajor ? rOuter + 2 : rOuter) * Math.sin(rad);

            return (
              <line
                key={idx}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={
                  t.isPastCurrent 
                    ? '#ff5500' 
                    : isDark ? '#383838' : '#d1d5db'
                }
                strokeWidth={t.isMajor ? 1.6 : 1.1}
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        {/* Knob Body with 3D Industrial Depth */}
        <div
          className="rounded-full relative flex items-center justify-center transition-transform duration-75 ease-out shadow-xl"
          style={{
            width: size,
            height: size,
            transform: `rotate(${currentAngle}deg)`,
            background: isDark
              ? 'radial-gradient(circle at 45% 40%, #303030 0%, #202020 65%, #151515 100%)'
              : 'radial-gradient(circle at 45% 40%, #ffffff 0%, #e2e4e9 65%, #c8c9ce 100%)',
            boxShadow: isDark
              ? '0 6px 14px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.1), inset 0 -2px 4px rgba(0,0,0,0.8)'
              : '0 4px 10px rgba(0,0,0,0.15), inset 0 1px 2px rgba(255,255,255,0.8), inset 0 -2px 3px rgba(0,0,0,0.15)'
          }}
        >
          {/* Subtle outer bezel groove */}
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

          {/* Precision Orange Indicator Notch (towards the top/current angle) */}
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
