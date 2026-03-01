import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import { Trophy, Zap, RefreshCw, Music, AlertTriangle, ShieldCheck, Maximize2, CheckCircle2, Move } from 'lucide-react';
import { BOPPO_CONFIG, GAME_COLORS } from './constants';
import { GameState, CalibrationData } from './types';
import { BoppoButton } from './components/BoppoButton';

// Sound Manager (Singleton AudioContext to prevent "too many contexts" error)
let sharedAudioCtx: AudioContext | null = null;

const getAudioCtx = () => {
  if (!sharedAudioCtx) {
    sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return sharedAudioCtx;
};

const playSound = (type: 'tap' | 'success' | 'fail' | 'start' | 'warn') => {
  const frequencies = {
    tap: 440,
    success: 880,
    fail: 110,
    start: 660,
    warn: 330
  };
  
  try {
    const audioCtx = getAudioCtx();
    
    // Force resume on every play to handle mobile aggressive suspension
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    // Use more audible waveforms for success/tap
    if (type === 'success') {
      oscillator.type = 'triangle';
    } else if (type === 'fail') {
      oscillator.type = 'sawtooth';
    } else if (type === 'warn') {
      oscillator.type = 'triangle';
    } else {
      oscillator.type = 'sine';
    }

    const now = audioCtx.currentTime;
    oscillator.frequency.setValueAtTime(frequencies[type], now);
    
    // Snappier envelope
    gainNode.gain.setValueAtTime(0.15, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.2);
  } catch (e) {
    console.warn("Audio context error", e);
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
    status: 'calibrating',
    difficulty: 1,
    calibration: {
      width: Math.min(window.innerWidth - 40, 400),
      height: Math.min(window.innerHeight - 150, 600),
      padding: 16
    }
  });

  const spawnTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startGame = () => {
    // Ensure audio context is active on first user interaction
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    playSound('start');
    const randomDanger = GAME_COLORS[Math.floor(Math.random() * GAME_COLORS.length)];
    setGameState(prev => ({
      ...prev,
      score: 0,
      streak: 0,
      buttonColors: Array(10).fill(null),
      dangerColor: randomDanger,
      status: 'playing',
      difficulty: 1
    }));
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
    // Ensure audio context is active on every interaction
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

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

  const finishCalibration = () => {
    triggerHaptic('light');
    playSound('tap');
    setGameState(prev => ({ ...prev, status: 'idle' }));
  };

  const updateCalibration = (updates: Partial<CalibrationData>) => {
    setGameState(prev => ({
      ...prev,
      calibration: { ...prev.calibration, ...updates }
    }));
  };

  if (gameState.status === 'calibrating') {
    return (
      <div className={`min-h-screen ${BOPPO_CONFIG.bgClass} text-white font-sans flex flex-col items-center justify-center p-4 safe-area-inset`}>
        <div className="text-center mb-8">
          <Maximize2 size={48} className="mx-auto mb-4 text-emerald-400" />
          <h1 className="text-3xl font-black italic uppercase tracking-tighter mb-2">Calibrate Boppo</h1>
          <p className="text-sm opacity-60 max-w-xs mx-auto">Drag the handles to fit the device to your screen. Make it comfortable for your thumbs!</p>
        </div>

        <div className="relative flex items-center justify-center">
          {/* Resizable Frame Preview */}
          <div 
            className="bg-zinc-800/90 rounded-[2.5rem] border-4 border-zinc-700/50 shadow-2xl relative flex flex-col p-4"
            style={{ 
              width: gameState.calibration.width, 
              height: gameState.calibration.height 
            }}
          >
            <div className="flex-1 border-2 border-dashed border-white/10 rounded-[1.5rem] flex items-center justify-center">
              <Move className="opacity-20" size={48} />
            </div>

            {/* Resize Handles */}
            {/* Top Handle */}
            <motion.div 
              drag="y"
              dragMomentum={false}
              onDrag={(_, info) => updateCalibration({ height: Math.max(300, gameState.calibration.height - info.delta.y * 2) })}
              className="absolute -top-4 left-1/2 -translate-x-1/2 w-16 h-8 bg-emerald-500/20 hover:bg-emerald-500/40 rounded-full cursor-ns-resize flex items-center justify-center border border-emerald-500/30 z-20"
            >
              <div className="w-8 h-1 bg-emerald-500 rounded-full" />
            </motion.div>

            {/* Left Handle */}
            <motion.div 
              drag="x"
              dragMomentum={false}
              onDrag={(_, info) => updateCalibration({ width: Math.max(200, gameState.calibration.width - info.delta.x * 2) })}
              className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-16 bg-emerald-500/20 hover:bg-emerald-500/40 rounded-full cursor-ew-resize flex items-center justify-center border border-emerald-500/30 z-20"
            >
              <div className="w-1 h-8 bg-emerald-500 rounded-full" />
            </motion.div>

            {/* Right Handle */}
            <motion.div 
              drag="x"
              dragMomentum={false}
              onDrag={(_, info) => updateCalibration({ width: Math.max(200, gameState.calibration.width + info.delta.x * 2) })}
              className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-16 bg-emerald-500/20 hover:bg-emerald-500/40 rounded-full cursor-ew-resize flex items-center justify-center border border-emerald-500/30 z-20"
            >
              <div className="w-1 h-8 bg-emerald-500 rounded-full" />
            </motion.div>

            {/* Bottom Handle */}
            <motion.div 
              drag="y"
              dragMomentum={false}
              onDrag={(_, info) => updateCalibration({ height: Math.max(300, gameState.calibration.height + info.delta.y * 2) })}
              className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-16 h-8 bg-emerald-500/20 hover:bg-emerald-500/40 rounded-full cursor-ns-resize flex items-center justify-center border border-emerald-500/30 z-20"
            >
              <div className="w-8 h-1 bg-emerald-500 rounded-full" />
            </motion.div>

            {/* Corner Handle (Bottom Right) */}
            <motion.div 
              drag
              dragMomentum={false}
              onDrag={(_, info) => updateCalibration({ 
                width: Math.max(200, gameState.calibration.width + info.delta.x * 2),
                height: Math.max(300, gameState.calibration.height + info.delta.y * 2)
              })}
              className="absolute -right-4 -bottom-4 w-10 h-10 bg-emerald-500/30 hover:bg-emerald-500/50 rounded-xl cursor-nwse-resize flex items-center justify-center border-2 border-emerald-500/50 z-30 shadow-lg"
            >
              <Maximize2 size={16} className="text-emerald-400 rotate-90" />
            </motion.div>
          </div>
        </div>

        <div className="flex gap-4 mt-12">
          <button
            onClick={() => updateCalibration({ 
              width: Math.min(window.innerWidth - 40, 400), 
              height: Math.min(window.innerHeight - 200, 600) 
            })}
            className="bg-white/5 hover:bg-white/10 text-white/60 px-6 py-4 rounded-2xl font-bold uppercase tracking-widest text-xs border border-white/10"
          >
            Reset
          </button>
          
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={finishCalibration}
            className="bg-emerald-500 text-black px-12 py-4 rounded-2xl font-black uppercase tracking-tighter text-lg shadow-[0_0_30px_rgba(16,185,129,0.3)] flex items-center gap-3"
          >
            <CheckCircle2 size={24} />
            Proceed
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${BOPPO_CONFIG.bgClass} text-white font-sans selection:bg-white/20 flex flex-col items-center justify-center p-2 transition-colors duration-700 safe-area-inset`}>
      
      {/* Device Frame - Uses Calibrated Dimensions */}
      <div 
        className="bg-zinc-800/90 rounded-[2.5rem] border-4 border-zinc-700/50 shadow-2xl relative overflow-hidden flex flex-col"
        style={{ 
          width: gameState.calibration.width, 
          height: gameState.calibration.height,
          padding: gameState.calibration.padding
        }}
      >
        
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

        {/* The Grid - Fills the available space */}
        <div className="grid grid-cols-5 gap-2 mb-4 flex-1 items-center">
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
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/50">
                  <AlertTriangle size={32} className="text-red-500" />
                </div>
                <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-1">Danger Hit!</h2>
                <p className="text-[10px] font-mono opacity-50 mb-6 uppercase tracking-widest">You touched the forbidden color</p>
                
                <div className="bg-white/5 rounded-2xl p-4 mb-6 border border-white/10">
                  <div className="text-[8px] uppercase font-bold opacity-40 mb-1">Final Score</div>
                  <div className="text-4xl font-mono text-emerald-400">{gameState.score}</div>
                </div>

                <button
                  onClick={startGame}
                  className="w-full bg-white text-black py-3 rounded-xl font-black uppercase tracking-tighter text-sm"
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
