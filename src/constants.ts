import { 
  Circle, Square, Triangle, Hexagon, Pentagon
} from 'lucide-react';
import { GameState } from './types';

export const BOPPO_CONFIG = {
  colors: [
    '#FF595E', '#FFCA3A', '#8AC926', '#1982C4', '#6A4C93',
    '#FF595E', '#FFCA3A', '#8AC926', '#1982C4', '#6A4C93'
  ],
  bgClass: 'bg-[#0F1115]',
};

export const GAME_COLORS = [
  '#FF595E', // Red
  '#FFCA3A', // Yellow
  '#8AC926', // Green
  '#1982C4', // Blue
  '#6A4C93', // Purple
  '#F27D26', // Orange
];

export const INITIAL_GAME_STATE: GameState = {
  score: 0,
  streak: 0,
  highScore: 0,
  buttonColors: Array(10).fill(null),
  dangerColor: null,
  status: 'idle',
  difficulty: 1
};
