import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BoppoButtonProps } from '../types';

export const BoppoButton: React.FC<BoppoButtonProps> = ({ 
  index, 
  activeColor, 
  defaultColor,
  icon: Icon, 
  onPress,
  theme
}) => {
  const isColored = activeColor !== null;
  const displayColor = activeColor || '#FFFFFF';

  return (
    <motion.button
      id={`boppo-btn-${index}`}
      whileTap={{ scale: 0.92, y: 2 }}
      onClick={() => onPress(index)}
      className={`
        relative w-full aspect-square rounded-3xl flex items-center justify-center
        transition-all duration-300 overflow-hidden
        ${isColored ? 'brightness-110' : 'brightness-90 opacity-90'}
      `}
      style={{ 
        backgroundColor: displayColor,
        boxShadow: isColored 
          ? `0 0 30px ${displayColor}AA, inset 0 0 15px rgba(255,255,255,0.5)` 
          : `0 0 15px rgba(255,255,255,0.3), inset 0 2px 4px rgba(0,0,0,0.1)`,
        border: isColored ? `4px solid white` : `4px solid rgba(255,255,255,0.2)`
      }}
    >
      {/* Inner Glow Effect for White State */}
      {!isColored && (
        <div className="absolute inset-0 bg-white/10 blur-md rounded-full" />
      )}

      {/* Pulsing Effect for Colored State */}
      <AnimatePresence>
        {isColored && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ 
              opacity: [0.2, 0.4, 0.2],
              scale: [1, 1.1, 1]
            }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="absolute inset-0 bg-white/20 blur-xl rounded-full"
          />
        )}
      </AnimatePresence>

      <Icon 
        size={32} 
        strokeWidth={2.5}
        className={`
          z-10 transition-all duration-300
          ${isColored ? 'text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.5)] scale-110' : 'text-black/20'}
        `} 
      />

      {/* Tactile Rim */}
      <div className="absolute inset-0 border-[6px] border-black/5 rounded-3xl pointer-events-none" />
    </motion.button>
  );
};
