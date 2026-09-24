import React from 'react';
import { soundFx } from '../../utils/haptics';

interface TactileButtonProps {
  active?: boolean;
  onClick?: () => void;
  icon: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  ariaLabel?: string;
  isDark?: boolean;
}

export const TactileButton: React.FC<TactileButtonProps> = ({
  active = false,
  onClick,
  icon,
  size = 'md',
  ariaLabel,
  isDark = true
}) => {
  const sizeClasses = {
    sm: 'w-11 h-11',
    md: 'w-16 h-16',
    lg: 'w-20 h-20'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  const handleClick = () => {
    soundFx.click(active ? 'release' : 'press');
    if (onClick) onClick();
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={handleClick}
      className={`relative group rounded-full flex items-center justify-center transition-all duration-100 active:scale-95 outline-none select-none cursor-pointer ${sizeClasses[size]}`}
      style={{
        background: isDark
          ? 'radial-gradient(circle at 45% 35%, #353535 0%, #1e1e1e 75%, #141414 100%)'
          : 'radial-gradient(circle at 45% 35%, #ffffff 0%, #e0e1e6 75%, #cbccd2 100%)',
        boxShadow: active
          ? isDark
            ? '0 0 16px rgba(255,85,0,0.4), inset 0 2px 4px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.5)'
            : '0 0 14px rgba(255,85,0,0.4), inset 0 2px 3px rgba(0,0,0,0.3)'
          : isDark
            ? '0 4px 10px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.1), inset 0 -2px 3px rgba(0,0,0,0.8)'
            : '0 3px 8px rgba(0,0,0,0.15), inset 0 1px 2px rgba(255,255,255,0.9), inset 0 -2px 2px rgba(0,0,0,0.1)'
      }}
    >
      {/* Outer tactile bezel ring */}
      <div 
        className={`absolute inset-1 rounded-full border pointer-events-none ${
          isDark ? 'border-black/50' : 'border-black/10'
        }`} 
      />

      {/* Recessed Center Dish */}
      <div 
        className="w-[76%] h-[76%] rounded-full flex items-center justify-center transition-all duration-100"
        style={{
          background: active 
            ? isDark
              ? 'radial-gradient(circle at 45% 45%, #2a160d 0%, #170d06 100%)' 
              : 'radial-gradient(circle at 45% 45%, #ffe6d9 0%, #fcd6c3 100%)'
            : isDark
              ? 'radial-gradient(circle at 45% 45%, #252525 0%, #141414 100%)' 
              : 'radial-gradient(circle at 45% 45%, #eceef2 0%, #d8dae0 100%)',
          boxShadow: active 
            ? isDark
              ? 'inset 0 2px 5px rgba(0,0,0,0.9), inset 0 0 10px rgba(255,85,0,0.3)' 
              : 'inset 0 2px 4px rgba(0,0,0,0.2), inset 0 0 8px rgba(255,85,0,0.3)'
            : isDark
              ? 'inset 0 2px 4px rgba(0,0,0,0.8)' 
              : 'inset 0 1px 3px rgba(0,0,0,0.2)'
        }}
      >
        {/* Backlit Icon */}
        <div 
          className={`flex items-center justify-center transition-all duration-100 ${iconSizes[size]} ${
            active 
              ? 'text-[#ff5500] filter drop-shadow-[0_0_6px_rgba(255,85,0,0.9)] scale-105' 
              : isDark 
                ? 'text-[#505050] group-hover:text-[#707070]' 
                : 'text-[#8b919d] group-hover:text-[#555a64]'
          }`}
        >
          {icon}
        </div>
      </div>
    </button>
  );
};
