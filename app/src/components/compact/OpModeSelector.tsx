import React from 'react';
import { soundFx } from '../../utils/haptics';

export type SystemOpMode = string;

interface OpModeSelectorProps {
  currentMode: string;
  onSelectMode: (mode: any) => void;
  modes?: string[];
  isDark?: boolean;
}

export const OpModeSelector: React.FC<OpModeSelectorProps> = ({
  currentMode,
  onSelectMode,
  modes = ['BENCHMARK', 'REGRESSION', 'DIAGNOSTIC', 'SANDBOX', 'AUTO-EVAL'],
  isDark = true
}) => {
  const handleModeClick = (mode: string) => {
    soundFx.click('press');
    onSelectMode(mode);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full select-none py-2">
      <div className="font-mono flex flex-col space-y-1.5 tracking-wider text-xs sm:text-[13px]">
        {modes.map((mode) => {
          const isActive = currentMode === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => handleModeClick(mode)}
              className={`flex items-center gap-2 text-left transition-all duration-100 outline-none cursor-pointer ${
                isActive
                  ? isDark 
                    ? 'text-white font-bold scale-105' 
                    : 'text-zinc-950 font-bold scale-105'
                  : isDark 
                    ? 'text-[#606060] hover:text-[#909090]' 
                    : 'text-[#9ca3af] hover:text-[#6b7280]'
              }`}
            >
              {/* Bold Orange Dash indicator */}
              <span 
                className={`w-3.5 h-1 rounded-xs transition-opacity ${
                  isActive 
                    ? 'bg-[#ff5500] opacity-100 shadow-[0_0_6px_rgba(255,85,0,0.8)]' 
                    : 'opacity-0'
                }`}
              />
              <span className="font-mono font-medium">
                {mode}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
