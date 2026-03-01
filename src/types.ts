import { LucideIcon } from 'lucide-react';

export interface CalibrationData {
  width: number;
  height: number;
  padding: number;
}

export interface GameState {
  score: number;
  streak: number;
  highScore: number;
  buttonColors: (string | null)[];
  dangerColor: string | null;
  status: 'idle' | 'playing' | 'gameOver' | 'calibrating';
  difficulty: number; // 1 to 10
  calibration: CalibrationData;
}

export interface BoppoButtonProps {
  index: number;
  activeColor: string | null;
  defaultColor: string;
  icon: LucideIcon;
  onPress: (index: number) => void;
}
