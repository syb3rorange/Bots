import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BoppoButtonProps } from '../types';

export const BoppoButton: React.FC<BoppoButtonProps> = ({ 
  index, 
  activeColor, 
  onPress
}) => {
  const isColored = activeColor !== null;
  const displayColor = activeColor || '#FFFFFF';

  return (
    <motion.button
      id={`boppo-btn-${index}`}
      whileTap={{ scale: 0.94, y: 1 }}
      onClick={() => onPress(index)}
      className={`
        relative w-full aspect-square rounded-2xl flex items-center justify-center
        transition-all duration-150 overflow-hidden
        ${isColored ? 'brightness-110' : 'brightness-90 opacity-80'}
      `}
      style={{ 
        backgroundColor: isColored ? displayColor : 'rgba(255,255,255,0.05)',
        boxShadow: isColored 
          ? `0 0 25px ${displayColor}66, inset 0 0 10px rgba(255,255,255,0.3)` 
          : `inset 0 1px 2px rgba(255,255,255,0.05)`,
        border: isColored ? `2px solid rgba(255,255,255,0.4)` : `1px solid rgba(255,255,255,0.1)`
      }}
    >
      {/* Subtle Inner Glow for White State */}
      {!isColored && (
        <div className="absolute inset-0 bg-white/[0.02] rounded-full" />
      )}

      {/* Professional Pulsing Effect for Colored State */}
      <AnimatePresence>
        {isColored && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0.1, 0.3, 0.1],
            }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute inset-0 bg-white/10 blur-lg rounded-full"
          />
        )}
      </AnimatePresence>

      {/* Minimal Center Dot for Active State */}
      {isColored && (
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-2 h-2 bg-white rounded-full shadow-[0_0_10px_white]"
        />
      )}
    </motion.button>
  );
};
