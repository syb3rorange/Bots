import { LucideIcon } from 'lucide-react';

export interface GameState {
  score: number;
  streak: number;
  highScore: number;
  buttonColors: (string | null)[];
  dangerColor: string | null;
  status: 'idle' | 'playing' | 'gameOver' | 'loading';
  difficulty: number; // 1 to 10
  mode: 'avoid' | 'target';
  isPaused: boolean;
}

export interface BoppoButtonProps {
  index: number;
  activeColor: string | null;
  onPress: (index: number) => void;
}
