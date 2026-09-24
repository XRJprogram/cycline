export type NoteType = 'tap' | 'hold' | 'touch';

export type JudgeGrade = 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS';

export type RankGrade = 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C';

export type BadgeGrade = 'AP' | 'FC' | 'CLEAR';

export type SceneType = 'TITLE' | 'SELECT' | 'GAMEPLAY' | 'RESULT';

export interface Note {
  id: number;
  time: number;          // Target hit time in seconds
  angle: number;         // Angle in degrees (0° = 12 o'clock, clockwise)
  type: NoteType;
  duration?: number;     // For hold notes in seconds (e.g. 0.5s - 4.0s)
  cycle?: number;        // Track cycle index: 0 for primary/inner, 1 for outer ring, etc. (default 0)
  judged: boolean;
  grade?: JudgeGrade;
  deltaMs?: number;

  // Runtime hold & touch state
  holding?: boolean;
  holdProgress?: number; // 0.0 to 1.0
  holdCompleted?: boolean;
  lastTickTime?: number;
  touchHit?: boolean;
  pendingJudgeResult?: JudgeResult;
}

export interface JudgeResult {
  note: Note;
  grade: JudgeGrade;
  deltaMs: number;
  scoreAdded: number;
  combo: number;
  isHoldTick?: boolean;
  isHoldComplete?: boolean;
  hitX?: number;
  hitY?: number;
}

export interface CycleEvent {
  cycle: number;        // Track index (e.g. 1)
  startTime: number;    // Appearance start time in seconds
  endTime: number;      // Disappearance finish time in seconds
  targetRadiusOffset?: number; // Target radius offset relative to main orbit (default +48px)
}

export interface DensityEvent {
  time: number;       // Trigger time in seconds
  density: number;    // Target visual density multiplier (1.0 = standard, >1 = packed closer, <1 = spread apart)
  duration?: number;  // Transition duration in seconds to smoothly interpolate from previous density
}

export type DifficultyType = 'EASY' | 'NORMAL' | 'HARD' | 'EX';

export interface DifficultyChart {
  level: number | string;// Integer or integer+ level (e.g. 5, "5+")
  notes: Note[];
  color?: string;
  rotationPeriod?: number;
  cycles?: number;                   // Number of concentric orbital tracks (default 1)
  cycleEvents?: CycleEvent[];        // Dynamic appearance & disappearance timings for extra cycles
  climaxRanges?: [number, number][]; // Time windows in seconds where climax visual effects activate
  densityEvents?: DensityEvent[];    // Optional density change events for unfurling / expanding effects
}

export interface ChartData {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  offset: number;        // Lead-in offset in seconds
  rotationPeriod: number;// Seconds per full 360° rotation
  notes: Note[];
  difficulty: DifficultyType | string;
  level: number | string;
  color?: string;
  cycles?: number;       // Number of concentric orbital tracks (default 1)
  cycleEvents?: CycleEvent[];
  audioUrl?: string;
  climaxRanges?: [number, number][];
  densityEvents?: DensityEvent[];
}

export interface SongInfo {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  offset: number;
  rotationPeriod: number;
  coverColor?: string;
  cycles?: number;
  cycleEvents?: CycleEvent[];
  difficulties: Partial<Record<DifficultyType, DifficultyChart>>;
  audioUrl?: string;
  climaxRanges?: [number, number][];
  densityEvents?: DensityEvent[];
}

export interface GameStats {
  score: number;
  combo: number;
  maxCombo: number;
  perfectCount: number;
  greatCount: number;
  goodCount: number;
  missCount: number;
  totalNotes: number;
}

export interface ResultSummary {
  songTitle: string;
  difficulty: string;
  rank: RankGrade;
  badge: BadgeGrade;
  score: number;
  accuracy: number;
  maxCombo: number;
  perfectCount: number;
  greatCount: number;
  goodCount: number;
  missCount: number;
  totalNotes: number;
}
