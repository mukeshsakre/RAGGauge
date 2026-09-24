import React, { useState, useEffect } from 'react';

interface DigitalLedClockProps {
  initialSeconds?: number;
  isLive?: boolean;
  isDark?: boolean;
}

export const DigitalLedClock: React.FC<DigitalLedClockProps> = ({
  initialSeconds = 667, // 11:07
  isLive = true,
  isDark = true
}) => {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [colonVisible, setColonVisible] = useState(true);

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setSeconds(prev => prev + 1);
      setColonVisible(prev => !prev);
    }, 1000);
    return () => clearInterval(interval);
  }, [isLive]);

  const mins = Math.floor(seconds / 60) % 100;
  const secs = seconds % 60;
  const formattedMins = String(mins).padStart(2, '0');
  const formattedSecs = String(secs).padStart(2, '0');

  // Frequency tick bars across the bottom
  const tickCount = 26;

  return (
    <div className="flex flex-col items-center justify-between h-full w-full py-2 select-none">
      {/* Centered Monospace Technical LED Clock Display */}
      <div className="flex-1 flex items-center justify-center">
        <div 
          className={`font-mono text-4xl sm:text-5xl font-semibold tracking-wider flex items-center gap-1.5 transition-colors ${
            isDark ? 'text-[#c0c0c0]' : 'text-[#2a2a2a]'
          }`}
        >
          <span className="tabular-nums">{formattedMins}</span>
          <span 
            className={`transition-opacity duration-150 ${
              colonVisible ? 'opacity-90' : 'opacity-20'
            }`}
          >
            :
          </span>
          <span className="tabular-nums">{formattedSecs}</span>
        </div>
      </div>

      {/* Barcode-like fine vertical tick bars across the bottom */}
      <div className="w-full flex items-end justify-between px-3 h-4 gap-0.5 opacity-30">
        {Array.from({ length: tickCount }).map((_, i) => {
          const isMid = i === Math.floor(tickCount / 2);
          const isEdge = i % 6 === 0;
          const height = isMid ? 'h-3.5' : isEdge ? 'h-2.5' : 'h-1.5';
          return (
            <div
              key={i}
              className={`w-0.5 transition-all duration-300 ${height} ${
                isDark ? 'bg-zinc-400' : 'bg-zinc-600'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
};
