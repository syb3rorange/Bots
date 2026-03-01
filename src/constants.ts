import { 
  Music, Guitar, Drum, Piano, Mic2, 
  Rocket, Orbit, Moon, Sun, Star,
  Circle, Square, Triangle, Hexagon, Pentagon,
  Volume2, Volume1, Bell, Radio, Speaker
} from 'lucide-react';
import { ThemeConfig, GameState } from './types';

export const THEMES: Record<string, ThemeConfig> = {
  classic: {
    id: 'classic',
    name: 'Classic Boppo',
    colors: [
      '#FF595E', '#FFCA3A', '#8AC926', '#1982C4', '#6A4C93',
      '#FF595E', '#FFCA3A', '#8AC926', '#1982C4', '#6A4C93'
    ],
    icons: [Circle, Square, Triangle, Hexagon, Pentagon, Circle, Square, Triangle, Hexagon, Pentagon],
    bgClass: 'bg-zinc-900',
    accentColor: '#FFFFFF'
  },
  symphony: {
    id: 'symphony',
    name: 'Symphony',
    colors: [
      '#E63946', '#F1FAEE', '#A8DADC', '#457B9D', '#1D3557',
      '#E63946', '#F1FAEE', '#A8DADC', '#457B9D', '#1D3557'
    ],
    icons: [Music, Guitar, Drum, Piano, Mic2, Volume2, Volume1, Bell, Radio, Speaker],
    bgClass: 'bg-stone-900',
    accentColor: '#F1FAEE'
  },
  space: {
    id: 'space',
    name: 'Deep Space',
    colors: [
      '#0B3D91', '#FC3D21', '#FFFFFF', '#8E44AD', '#2ECC71',
      '#0B3D91', '#FC3D21', '#FFFFFF', '#8E44AD', '#2ECC71'
    ],
    icons: [Rocket, Orbit, Moon, Sun, Star, Rocket, Orbit, Moon, Sun, Star],
    bgClass: 'bg-black',
    accentColor: '#FC3D21'
  }
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
