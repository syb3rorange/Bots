import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Zap, RefreshCw, Music, AlertTriangle, ShieldCheck, Activity, Target } from 'lucide-react';
import { BOPPO_CONFIG, GAME_COLORS } from './constants';
import { GameState } from './types';
import { BoppoButton } from './components/BoppoButton';

// Robust Sound Manager Singleton
class SoundManager {
  private static instance: SoundManager;
  private audioCtx: AudioContext | null = null;

  private constructor() {}

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  private init() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public play(type: 'tap' | 'success' | 'fail' | 'start' | 'warn') {
    const ctx = this.init();
    const frequencies = {
      tap: 600,
      success: 1200,
      fail: 150,
      start: 800,
      warn: 400
    };

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type === 'fail' ? 'sawtooth' : type === 'warn' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(frequencies[type], ctx.currentTime);
    
    // Quick pitch envelope for "pop" sound
    if (type === 'success') {
      oscillator.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.05);
    }

    gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.12);
  }
}

const triggerHaptic = (type: 'light' | 'heavy' = 'light') => {
  if ('vibrate' in navigator) {
    navigator.vibrate(type === 'heavy' ? [80, 40, 80] : 30);
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

  const buttonTimeoutsRef = useRef<(NodeJS.Timeout | null)[]>(Array(10).fill(null));
  const spawnTimerRef = useRef<NodeJS.Timeout | null>(null);
  const soundManager = useRef(SoundManager.getInstance());

  const clearButtonTimeout = (index: number) => {
    if (buttonTimeoutsRef.current[index]) {
      clearTimeout(buttonTimeoutsRef.current[index]!);
      buttonTimeoutsRef.current[index] = null;
    }
  };

  const startGame = () => {
    soundManager.current.play('start');
    const randomDanger = GAME_COLORS[Math.floor(Math.random() * GAME_COLORS.length)];
    
    // Clear all existing timeouts
    buttonTimeoutsRef.current.forEach((_, i) => clearButtonTimeout(i));

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
    setGameState(prev => {
      if (prev.status !== 'playing') return prev;

      const availableIndices = prev.buttonColors
        .map((c, i) => (c === null ? i : null))
        .filter(i => i !== null) as number[];

      if (availableIndices.length === 0) return prev;

      const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
      const randomColor = GAME_COLORS[Math.floor(Math.random() * GAME_COLORS.length)];
      
      const newButtonColors = [...prev.buttonColors];
      newButtonColors[randomIndex] = randomColor;

      // Schedule clear outside of this functional update using a separate effect or immediate call
      // But we need the duration which depends on difficulty.
      return { ...prev, buttonColors: newButtonColors };
    });
  }, []);

  // Effect to handle color clearing timeouts when buttonColors change
  useEffect(() => {
    if (gameState.status !== 'playing') return;

    gameState.buttonColors.forEach((color, index) => {
      if (color !== null && !buttonTimeoutsRef.current[index]) {
        const duration = Math.max(500, 1800 - (gameState.difficulty * 130));
        buttonTimeoutsRef.current[index] = setTimeout(() => {
          setGameState(prev => {
            if (prev.status !== 'playing') return prev;
            const updated = [...prev.buttonColors];
            updated[index] = null;
            return { ...prev, buttonColors: updated };
          });
          buttonTimeoutsRef.current[index] = null;
        }, duration);
      } else if (color === null && buttonTimeoutsRef.current[index]) {
        clearButtonTimeout(index);
      }
    });
  }, [gameState.buttonColors, gameState.status, gameState.difficulty]);

  useEffect(() => {
    if (gameState.status === 'playing') {
      const interval = Math.max(250, 900 - (gameState.difficulty * 70));
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
      soundManager.current.play('tap');
      return;
    }

    const pressedColor = gameState.buttonColors[index];

    if (pressedColor === null) {
      triggerHaptic('light');
      soundManager.current.play('tap');
      return;
    }

    // Clear timeout immediately on press
    clearButtonTimeout(index);

    if (pressedColor === gameState.dangerColor) {
      triggerHaptic('heavy');
      soundManager.current.play('fail');
      setGameState(prev => ({
        ...prev,
        status: 'gameOver',
        highScore: Math.max(prev.highScore, prev.score)
      }));
    } else {
      triggerHaptic('light');
      soundManager.current.play('success');
      setGameState(prev => {
        const newScore = prev.score + 1;
        const newDifficulty = Math.min(10, 1 + Math.floor(newScore / 7));
        const newButtonColors = [...prev.buttonColors];
        newButtonColors[index] = null;
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
    <div className={`min-h-screen ${BOPPO_CONFIG.bgClass} text-slate-200 font-sans selection:bg-white/10 flex flex-col items-center justify-center p-4 transition-colors duration-1000 safe-area-inset`}>
      
      {/* HUD / Header */}
      <div className="w-full max-w-lg mb-6 flex justify-between items-end px-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-slate-500">
            <Activity size={14} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">System Active</span>
          </div>
          <h1 className="text-3xl font-light tracking-tight text-white">
            REACTION<span className="font-bold">LAB</span>
          </h1>
        </div>

        <div className="flex gap-6">
          <div className="text-right">
            <p className="text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-1">Best</p>
            <p className="text-2xl font-mono text-white leading-none tabular-nums">{gameState.highScore.toString().padStart(3, '0')}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-1">Score</p>
            <p className="text-4xl font-mono text-emerald-400 leading-none tabular-nums">{gameState.score.toString().padStart(3, '0')}</p>
          </div>
        </div>
      </div>

      {/* Main Game Surface */}
      <div className="w-full max-w-lg bg-[#1A1D23] p-4 sm:p-8 rounded-[2.5rem] border border-white/5 shadow-[0_30px_60px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden">
        
        {/* Danger Indicator */}
        <div className="mb-6">
          <AnimatePresence mode="wait">
            {gameState.status === 'playing' ? (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="bg-black/40 rounded-2xl p-4 flex items-center justify-between border border-white/5 backdrop-blur-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                  <span className="text-[10px] uppercase font-bold tracking-[0.15em] text-slate-400">Avoid Target Color</span>
                </div>
                <div 
                  className="w-16 h-8 rounded-full border border-white/10 shadow-inner flex items-center justify-center"
                  style={{ backgroundColor: gameState.dangerColor || 'transparent' }}
                >
                  <AlertTriangle size={14} className="text-white/20" />
                </div>
              </motion.div>
            ) : (
              <div className="h-[66px] flex items-center justify-center border border-dashed border-white/5 rounded-2xl">
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-600">Ready for sequence</p>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* The Grid */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {Array.from({ length: 10 }).map((_, i) => (
            <BoppoButton
              key={i}
              index={i}
              activeColor={gameState.buttonColors[i]}
              onPress={handleButtonPress}
            />
          ))}
        </div>

        {/* Status Bar */}
        <div className="flex justify-center items-center h-6">
          <AnimatePresence mode="wait">
            {gameState.status === 'playing' && (
              <motion.div
                key="status"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3"
              >
                <div className="flex gap-1">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-1 h-3 rounded-full transition-all duration-500 ${i < gameState.difficulty ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-white/5'}`} 
                    />
                  ))}
                </div>
                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Intensity {gameState.difficulty}</span>
              </motion.div>
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
              className="absolute inset-0 bg-[#0F1115]/95 backdrop-blur-md flex flex-col items-center justify-center z-50 p-8 text-center"
            >
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                  <Target size={32} className="text-red-500" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Sequence Terminated</h2>
                <p className="text-xs font-medium text-slate-500 mb-10 uppercase tracking-widest">Critical error: Forbidden color detected</p>
                
                <div className="bg-white/[0.03] rounded-[2rem] p-8 border border-white/5 mb-4">
                  <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-2">Final Performance</p>
                  <p className="text-6xl font-mono text-emerald-400 tabular-nums">{gameState.score}</p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* External Action Button */}
      <div className="mt-8 w-full max-w-lg px-2">
        <AnimatePresence mode="wait">
          {(gameState.status === 'idle' || gameState.status === 'gameOver') && (
            <motion.button
              key="action-btn"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,1)' }}
              whileTap={{ scale: 0.98 }}
              onClick={startGame}
              className="w-full bg-white text-black py-5 rounded-3xl font-bold uppercase tracking-[0.2em] text-sm shadow-[0_20px_40px_-10px_rgba(255,255,255,0.2)] flex items-center justify-center gap-4 transition-colors"
            >
              <RefreshCw size={18} className={gameState.status === 'gameOver' ? 'animate-spin-slow' : ''} />
              {gameState.status === 'idle' ? 'Initialize Test' : 'Restart Sequence'}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Minimal Footer */}
      <div className="mt-8 opacity-20 flex items-center gap-4">
        <div className="h-px w-8 bg-white" />
        <span className="text-[8px] uppercase font-bold tracking-[0.4em]">Reaction Lab v3.0</span>
        <div className="h-px w-8 bg-white" />
      </div>
    </div>
  );
}
