import { LucideIcon } from 'lucide-react';

export type ThemeType = 'symphony' | 'space' | 'classic';

export interface ThemeConfig {
  id: ThemeType;
  name: string;
  colors: string[];
  icons: LucideIcon[];
  bgClass: string;
  accentColor: string;
}

export interface GameState {
  score: number;
  streak: number;
  highScore: number;
  buttonColors: (string | null)[];
  dangerColor: string | null;
  status: 'idle' | 'playing' | 'gameOver';
  difficulty: number; // 1 to 10
}

export interface BoppoButtonProps {
  index: number;
  activeColor: string | null;
  defaultColor: string;
  icon: LucideIcon;
  onPress: (index: number) => void;
  theme: ThemeType;
}
