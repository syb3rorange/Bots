import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Zap, RefreshCw, Music, AlertTriangle, ShieldCheck, Activity, Target, Loader2, Cpu, Database, Network, Pause, Play, Home } from 'lucide-react';
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

const LoadingPercentage = () => {
  const [percent, setPercent] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setPercent(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + Math.floor(Math.random() * 15) + 5;
      });
    }, 150);
    return () => clearInterval(interval);
  }, []);

  return <>{Math.min(100, percent)}%</>;
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    streak: 0,
    highScore: 0,
    buttonColors: Array(10).fill(null),
    dangerColor: null,
    status: 'idle',
    difficulty: 1,
    mode: 'avoid'
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

  const togglePause = () => {
    if (gameState.status !== 'playing') return;
    setGameState(prev => ({ ...prev, isPaused: !prev.isPaused }));
    soundManager.current.play('tap');
    triggerHaptic('light');
  };

  const goHome = () => {
    // Clear all existing timeouts
    buttonTimeoutsRef.current.forEach((_, i) => clearButtonTimeout(i));
    if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
    
    setGameState(prev => ({
      ...prev,
      status: 'idle',
      isPaused: false,
      buttonColors: Array(10).fill(null),
      score: 0
    }));
    soundManager.current.play('tap');
    triggerHaptic('light');
  };

  const startGame = (mode: 'avoid' | 'target' = 'avoid') => {
    soundManager.current.play('start');
    
    // Set to loading first
    setGameState(prev => ({
      ...prev,
      status: 'loading',
      mode,
      buttonColors: Array(10).fill(null),
    }));

    // Clear all existing timeouts
    buttonTimeoutsRef.current.forEach((_, i) => clearButtonTimeout(i));

    // Transition to playing after a delay
    setTimeout(() => {
      const randomDanger = GAME_COLORS[Math.floor(Math.random() * GAME_COLORS.length)];
      setGameState(prev => ({
        ...prev,
        score: 0,
        streak: 0,
        highScore: prev.highScore,
        buttonColors: Array(10).fill(null),
        dangerColor: randomDanger,
        status: 'playing',
        difficulty: 1
      }));
    }, 2000); // 2 second loading screen
  };

  const spawnColor = useCallback(() => {
    setGameState(prev => {
      if (prev.status !== 'playing' || prev.isPaused) return prev;

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
    if (gameState.status !== 'playing' || gameState.isPaused) {
      if (gameState.isPaused) {
        buttonTimeoutsRef.current.forEach((_, i) => clearButtonTimeout(i));
      }
      return;
    }

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
    if (gameState.status === 'playing' && !gameState.isPaused) {
      const interval = Math.max(250, 900 - (gameState.difficulty * 70));
      spawnTimerRef.current = setInterval(spawnColor, interval);
    } else {
      if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
    }
    return () => {
      if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
    };
  }, [gameState.status, gameState.difficulty, gameState.isPaused, spawnColor]);

  const handleButtonPress = (index: number) => {
    if (gameState.status !== 'playing' || gameState.isPaused) {
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

    const isCorrect = gameState.mode === 'avoid' 
      ? pressedColor !== gameState.dangerColor
      : pressedColor === gameState.dangerColor;

    if (!isCorrect) {
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
    <div className={`min-h-screen ${BOPPO_CONFIG.bgClass} text-slate-200 font-sans selection:bg-white/10 flex flex-col items-center p-6 transition-colors duration-1000 safe-area-inset overflow-hidden relative`}>
      
      {/* Background Effects (Consistent across app) */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none z-0">
        <div className="h-full w-full bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
      </div>
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/[0.03] blur-[150px] rounded-full pointer-events-none z-0" />

      {/* Full Screen Splash Screen */}
      <AnimatePresence>
        {gameState.status === 'loading' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#0F1115] z-[100] flex flex-col items-center justify-center p-8 overflow-hidden"
          >
            {/* Background scanning lines effect */}
            <div className="absolute inset-0 opacity-[0.05] pointer-events-none">
              <div className="h-full w-full bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
            </div>

            {/* Ambient Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative z-10 flex flex-col items-center"
            >
              <div className="mb-12 text-center">
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center justify-center gap-2 mb-2"
                >
                  <Activity size={16} className="text-emerald-500" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-emerald-500/60">System Initialization</span>
                </motion.div>
                <h1 className="text-4xl font-light tracking-tight text-white">
                  REACTION<span className="font-bold">LAB</span>
                </h1>
              </div>

              <div className="relative mb-12">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="w-32 h-32 border-t-2 border-r-2 border-emerald-500/20 rounded-full"
                />
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-2 border-b-2 border-l-2 border-emerald-400/40 rounded-full"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Cpu size={40} className="text-emerald-400 animate-pulse" />
                </div>
              </div>

              <div className="space-y-6 w-full max-w-[240px]">
                <div className="flex justify-between items-end">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-500/60">Core Status</span>
                    <span className="text-[8px] uppercase font-medium text-slate-500 tracking-[0.2em]">Optimizing Neural Pathways</span>
                  </div>
                  <motion.span 
                    key="percent"
                    className="text-xl font-mono text-emerald-400"
                  >
                    <LoadingPercentage />
                  </motion.span>
                </div>
                
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2, ease: "easeInOut" }}
                    className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.6)]"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="flex flex-col gap-1"
                  >
                    <div className="flex items-center gap-2 text-[8px] uppercase font-bold tracking-widest text-slate-400">
                      <Database size={10} className="text-emerald-500" />
                      <span>Memory</span>
                    </div>
                    <div className="h-0.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div animate={{ x: [-20, 40] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-1/2 h-full bg-emerald-500/40" />
                    </div>
                  </motion.div>
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="flex flex-col gap-1"
                  >
                    <div className="flex items-center gap-2 text-[8px] uppercase font-bold tracking-widest text-slate-400">
                      <Network size={10} className="text-emerald-500" />
                      <span>Uplink</span>
                    </div>
                    <div className="h-0.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div animate={{ x: [40, -20] }} transition={{ duration: 1.2, repeat: Infinity }} className="w-1/2 h-full bg-emerald-500/40" />
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>

            <div className="absolute bottom-12 left-0 right-0 text-center">
              <p className="text-[8px] uppercase font-bold tracking-[0.5em] text-slate-700">Authorized Personnel Only</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pause Overlay */}
      <AnimatePresence>
        {gameState.isPaused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#0F1115]/80 backdrop-blur-md z-[105] flex flex-col items-center justify-center p-8 text-center"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              className="relative z-10 w-full max-w-sm"
            >
              <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <Pause size={40} className="text-emerald-500" />
              </div>
              <h2 className="text-4xl font-bold tracking-tighter text-white mb-3 uppercase">Neural Link<br/>Suspended</h2>
              <p className="text-[10px] font-bold text-slate-500 mb-12 uppercase tracking-[0.4em]">System in standby mode</p>
              
              <div className="flex flex-col gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={togglePause}
                  className="w-full bg-white text-black py-6 rounded-[2rem] font-bold uppercase tracking-[0.3em] text-xs shadow-[0_25px_50px_-12px_rgba(255,255,255,0.25)] flex items-center justify-center gap-4"
                >
                  <Play size={18} />
                  Resume Link
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={goHome}
                  className="w-full bg-white/5 text-white py-6 rounded-[2rem] font-bold uppercase tracking-[0.3em] text-xs border border-white/10 flex items-center justify-center gap-4"
                >
                  <Home size={18} />
                  Return Home
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD / Header */}
      <div className="w-full max-w-lg mb-12 flex justify-between items-start z-10 pt-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-emerald-500/50">
            <Activity size={12} className="animate-pulse" />
            <span className="text-[9px] font-bold uppercase tracking-[0.3em]">Neural Link Active</span>
          </div>
          <h1 className="text-2xl font-light tracking-tighter text-white">
            REACTION<span className="font-bold text-emerald-500">LAB</span>
          </h1>
        </div>

        <div className="flex flex-col items-end gap-4">
          <div className="flex gap-3">
            {gameState.status === 'playing' && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={togglePause}
                className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                {gameState.isPaused ? <Play size={16} /> : <Pause size={16} />}
              </motion.button>
            )}
            {(gameState.status === 'playing' || gameState.status === 'gameOver') && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={goHome}
                className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Home size={16} />
              </motion.button>
            )}
          </div>
          
          <div className="flex gap-8">
            <div className="text-right">
              <p className="text-[8px] uppercase font-bold text-slate-500 tracking-widest mb-1">High Score</p>
              <p className="text-xl font-mono text-white leading-none tabular-nums opacity-60">{gameState.highScore.toString().padStart(3, '0')}</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] uppercase font-bold text-emerald-500/60 tracking-widest mb-1">Current</p>
              <p className="text-4xl font-mono text-emerald-400 leading-none tabular-nums drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">{gameState.score.toString().padStart(3, '0')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Game Area (Full Screen Layout) */}
      <div className="flex-1 w-full max-w-lg flex flex-col z-10">
        
        {/* Mode Indicator */}
        <div className="mb-10">
          <AnimatePresence mode="wait">
            {gameState.status === 'playing' ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="bg-white/[0.02] rounded-3xl p-5 flex items-center justify-between border border-white/5 backdrop-blur-md shadow-2xl"
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className={`w-3 h-3 rounded-full ${gameState.mode === 'avoid' ? 'bg-red-500' : 'bg-emerald-500'} animate-ping absolute inset-0 opacity-40`} />
                    <div className={`w-3 h-3 rounded-full ${gameState.mode === 'avoid' ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]' : 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]'} relative z-10`} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-white">
                      {gameState.mode === 'avoid' ? 'Threat Signature' : 'Target Frequency'}
                    </span>
                    <span className="text-[8px] uppercase font-medium text-slate-500 tracking-widest">
                      {gameState.mode === 'avoid' ? 'Avoid matching frequency' : 'Synchronize with frequency'}
                    </span>
                  </div>
                </div>
                <div 
                  className="w-20 h-10 rounded-2xl border border-white/10 shadow-inner flex items-center justify-center transition-colors duration-500"
                  style={{ backgroundColor: gameState.dangerColor || 'transparent' }}
                >
                  {gameState.mode === 'avoid' ? (
                    <AlertTriangle size={16} className="text-white/30" />
                  ) : (
                    <Target size={16} className="text-white/30" />
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="h-[82px] flex flex-col items-center justify-center border border-dashed border-white/10 rounded-3xl bg-white/[0.01]">
                <Loader2 size={20} className="text-slate-700 animate-spin-slow mb-2" />
                <p className="text-[9px] uppercase font-bold tracking-[0.3em] text-slate-600">Awaiting Sequence Command</p>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* The Grid - Larger for Mobile */}
        <div className="grid grid-cols-5 gap-4 mb-10 px-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <BoppoButton
              key={i}
              index={i}
              activeColor={gameState.buttonColors[i]}
              onPress={handleButtonPress}
            />
          ))}
        </div>

        {/* Status Bar / Intensity */}
        <div className="flex flex-col items-center gap-4 mb-12">
          <AnimatePresence mode="wait">
            {gameState.status === 'playing' && (
              <motion.div
                key="status"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center gap-3 w-full"
              >
                <div className="flex gap-1.5 w-full max-w-[200px]">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div 
                      key={i} 
                      className={`flex-1 h-1.5 rounded-full transition-all duration-700 ${i < gameState.difficulty ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-white/5'}`} 
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Zap size={10} className="text-emerald-500" />
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-[0.3em]">Intensity Level 0{gameState.difficulty}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Game Over Overlay - Full Screen Fixed */}
        <AnimatePresence>
          {gameState.status === 'gameOver' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#0F1115]/98 backdrop-blur-xl flex flex-col items-center justify-center z-[110] p-10 text-center overflow-hidden"
            >
              {/* Background scanning lines effect */}
              <div className="absolute inset-0 opacity-[0.05] pointer-events-none">
                <div className="h-full w-full bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
              </div>

              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }} 
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="relative z-10 w-full max-w-sm"
              >
                <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                  <Target size={40} className="text-red-500" />
                </div>
                
                <h2 className="text-4xl font-bold tracking-tighter text-white mb-3">SEQUENCE<br/>TERMINATED</h2>
                <div className="h-px w-12 bg-red-500/50 mx-auto mb-8" />
                
                <p className="text-[10px] font-bold text-slate-500 mb-12 uppercase tracking-[0.4em]">
                  {gameState.mode === 'avoid' ? 'Critical failure: Neural desync detected' : 'Target lost: Frequency synchronization failed'}
                </p>
                
                <div className="bg-white/[0.02] rounded-[3rem] p-10 border border-white/5 mb-12 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-emerald-500/[0.02] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <p className="text-[10px] uppercase font-bold text-slate-500 tracking-[0.3em] mb-4">Performance Index</p>
                  <p className="text-8xl font-mono text-emerald-400 tabular-nums drop-shadow-[0_0_20px_rgba(52,211,153,0.4)]">{gameState.score}</p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => startGame(gameState.mode)}
                  className="w-full bg-white text-black py-6 rounded-[2rem] font-bold uppercase tracking-[0.3em] text-xs shadow-[0_25px_50px_-12px_rgba(255,255,255,0.25)] flex items-center justify-center gap-4"
                >
                  <RefreshCw size={18} className="animate-spin-slow" />
                  Re-Initialize Link
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action Buttons for Idle State */}
      <div className="w-full max-w-lg z-10 pb-8 flex flex-col gap-4">
        <AnimatePresence mode="wait">
          {gameState.status === 'idle' && (
            <>
              <motion.button
                key="avoid-btn"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => startGame('avoid')}
                className="w-full bg-white text-black py-6 rounded-[2rem] font-bold uppercase tracking-[0.3em] text-xs shadow-[0_25px_50px_-12px_rgba(255,255,255,0.2)] flex items-center justify-center gap-4"
              >
                <AlertTriangle size={18} className="text-red-600" />
                Avoid Mode
              </motion.button>
              <motion.button
                key="target-btn"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: 0.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => startGame('target')}
                className="w-full bg-emerald-500 text-white py-6 rounded-[2rem] font-bold uppercase tracking-[0.3em] text-xs shadow-[0_25px_50px_-12px_rgba(16,185,129,0.2)] flex items-center justify-center gap-4 border border-emerald-400/30"
              >
                <Target size={18} className="text-white" />
                Target Mode
              </motion.button>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Minimal Footer */}
      <div className="mt-auto pb-6 opacity-30 flex items-center gap-6 z-10">
        <div className="h-px w-12 bg-white/20" />
        <span className="text-[9px] uppercase font-bold tracking-[0.5em] text-slate-400">Reaction Lab v3.5 // Mobile Optimized</span>
        <div className="h-px w-12 bg-white/20" />
      </div>
    </div>
  );
}
