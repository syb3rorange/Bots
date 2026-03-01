import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Zap, RefreshCw, Music, AlertTriangle, ShieldCheck } from 'lucide-react';
import { BOPPO_CONFIG, GAME_COLORS } from './constants';
import { GameState } from './types';
import { BoppoButton } from './components/BoppoButton';

// Sound Manager
const playSound = (type: 'tap' | 'success' | 'fail' | 'start' | 'warn') => {
  const frequencies = {
    tap: 440,
    success: 880,
    fail: 110,
    start: 660,
    warn: 330
  };
  
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = type === 'fail' ? 'sawtooth' : type === 'warn' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(frequencies[type], audioCtx.currentTime);
    
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.15);
  } catch (e) {
    console.warn("Audio context not supported", e);
  }
};

const triggerHaptic = (type: 'light' | 'heavy' = 'light') => {
  if ('vibrate' in navigator) {
    navigator.vibrate(type === 'heavy' ? [100, 50, 100] : 50);
  }
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    streak: 0,
    highScore: 0,
    buttonColors: Array(10).fill(null),
    dangerColor: null,
    status: 'idle',
    difficulty: 1
  });

  const spawnTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startGame = () => {
    playSound('start');
    const randomDanger = GAME_COLORS[Math.floor(Math.random() * GAME_COLORS.length)];
    setGameState({
      score: 0,
      streak: 0,
      highScore: gameState.highScore,
      buttonColors: Array(10).fill(null),
      dangerColor: randomDanger,
      status: 'playing',
      difficulty: 1
    });
  };

  const spawnColor = useCallback(() => {
    if (gameState.status !== 'playing') return;

    setGameState(prev => {
      const availableIndices = prev.buttonColors
        .map((c, i) => (c === null ? i : null))
        .filter(i => i !== null) as number[];

      if (availableIndices.length === 0) return prev;

      const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
      const randomColor = GAME_COLORS[Math.floor(Math.random() * GAME_COLORS.length)];
      
      const newButtonColors = [...prev.buttonColors];
      newButtonColors[randomIndex] = randomColor;

      // Clear color after duration
      const duration = Math.max(600, 2000 - (prev.difficulty * 150));
      setTimeout(() => {
        setGameState(current => {
          if (current.status !== 'playing') return current;
          const updated = [...current.buttonColors];
          updated[randomIndex] = null;
          return { ...current, buttonColors: updated };
        });
      }, duration);

      return { ...prev, buttonColors: newButtonColors };
    });
  }, [gameState.status]);

  // Spawning loop
  useEffect(() => {
    if (gameState.status === 'playing') {
      const interval = Math.max(300, 1000 - (gameState.difficulty * 80));
      spawnTimerRef.current = setInterval(spawnColor, interval);
    } else {
      if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
    }
    return () => {
      if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
    };
  }, [gameState.status, gameState.difficulty, spawnColor]);

  const handleButtonPress = (index: number) => {
    if (gameState.status !== 'playing') {
      triggerHaptic('light');
      playSound('tap');
      return;
    }

    const pressedColor = gameState.buttonColors[index];

    if (pressedColor === null) {
      // Tapping white is safe but no score
      triggerHaptic('light');
      playSound('tap');
      return;
    }

    if (pressedColor === gameState.dangerColor) {
      // GAME OVER
      triggerHaptic('heavy');
      playSound('fail');
      setGameState(prev => ({
        ...prev,
        status: 'gameOver',
        highScore: Math.max(prev.highScore, prev.score)
      }));
    } else {
      // SUCCESS
      triggerHaptic('light');
      playSound('success');
      setGameState(prev => {
        const newScore = prev.score + 1;
        const newDifficulty = Math.min(10, 1 + Math.floor(newScore / 8));
        const newButtonColors = [...prev.buttonColors];
        newButtonColors[index] = null; // Clear immediately on tap
        return {
          ...prev,
          score: newScore,
          difficulty: newDifficulty,
          buttonColors: newButtonColors
        };
      });
    }
  };

  return (
    <div className={`min-h-screen ${BOPPO_CONFIG.bgClass} text-white font-sans selection:bg-white/20 flex flex-col items-center justify-center p-2 transition-colors duration-700 safe-area-inset`}>
      
      {/* Device Frame */}
      <div className="w-full max-w-lg bg-zinc-800/90 p-4 sm:p-6 rounded-[2rem] border-4 border-zinc-700/50 shadow-2xl relative overflow-hidden">
        
        {/* Hardware Details */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-zinc-900 rounded-full opacity-30" />

        {/* HUD */}
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-black italic tracking-tighter opacity-90">BOPPO</h1>
            <div className="flex gap-2 items-center">
              <div className="text-right">
                <div className="text-[7px] uppercase font-bold opacity-40">Best</div>
                <div className="text-sm font-mono leading-none">{gameState.highScore.toString().padStart(3, '0')}</div>
              </div>
              <div className="h-4 w-px bg-white/10" />
              <div className="text-right">
                <div className="text-[7px] uppercase font-bold opacity-40">Score</div>
                <div className="text-xl font-mono leading-none text-emerald-400">{gameState.score.toString().padStart(3, '0')}</div>
              </div>
            </div>
          </div>

          {/* Danger Zone Indicator */}
          <AnimatePresence mode="wait">
            {gameState.status === 'playing' && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="bg-black/40 rounded-xl p-2 flex items-center justify-between border border-white/5"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle size={12} className="text-red-500 animate-pulse" />
                  <span className="text-[8px] uppercase font-black tracking-widest text-red-500">Avoid:</span>
                </div>
                <div 
                  className="w-8 h-4 rounded-full border border-white/20 shadow-inner"
                  style={{ backgroundColor: gameState.dangerColor || 'transparent' }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* The Grid - Optimized for Mobile (5x2 as requested) */}
        <div className="grid grid-cols-5 gap-2 mb-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <BoppoButton
              key={i}
              index={i}
              activeColor={gameState.buttonColors[i]}
              defaultColor={BOPPO_CONFIG.colors[i]}
              icon={BOPPO_CONFIG.icons[i]}
              onPress={handleButtonPress}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex justify-center items-center">
          <AnimatePresence mode="wait">
            {gameState.status !== 'playing' ? (
              <motion.button
                key="start"
                whileTap={{ scale: 0.95 }}
                onClick={startGame}
                className="bg-emerald-500 text-black px-12 py-2 rounded-xl font-black uppercase tracking-tighter text-sm shadow-lg"
              >
                {gameState.status === 'idle' ? 'Start' : 'Retry'}
              </motion.button>
            ) : (
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={12} className="text-emerald-500" />
                <span className="text-[8px] font-mono opacity-50 uppercase tracking-widest">Lvl {gameState.difficulty}</span>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Game Over Overlay */}
        <AnimatePresence>
          {gameState.status === 'gameOver' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-50 p-6 text-center"
            >
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/50">
                  <AlertTriangle size={40} className="text-red-500" />
                </div>
                <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-1">Danger Hit!</h2>
                <p className="text-sm font-mono opacity-50 mb-8 uppercase tracking-widest">You touched the forbidden color</p>
                
                <div className="bg-white/5 rounded-3xl p-6 mb-8 border border-white/10">
                  <div className="text-[10px] uppercase font-bold opacity-40 mb-1">Final Score</div>
                  <div className="text-5xl font-mono text-emerald-400">{gameState.score}</div>
                </div>

                <button
                  onClick={startGame}
                  className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase tracking-tighter text-lg"
                >
                  Try Again
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile Instructions */}
      <div className="mt-4 px-4 text-center opacity-40">
        <p className="text-[8px] uppercase font-black tracking-[0.2em] mb-1">How to Play</p>
        <p className="text-[10px] font-medium leading-tight">
          Avoid the <span className="text-red-400">Danger Color</span>. 
          Tap any other color to score. Speed increases as you level up!
        </p>
      </div>
    </div>
  );
}
