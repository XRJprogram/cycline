import { ChartData, DifficultyType, DifficultyChart, Note, SongInfo } from '../types';

export const DIFFICULTY_COLORS: Record<DifficultyType, string> = {
  EASY: '#3498db',   // Blue
  NORMAL: '#f1c40f', // Yellow
  HARD: '#e74c3c',   // Red
  EX: '#7f8c8d'      // Gray
};

export const DIFFICULTY_ORDER: DifficultyType[] = ['EASY', 'NORMAL', 'HARD', 'EX'];

/**
 * Formats difficulty level as an integer or integer+ (e.g. 5, "5+", 8, "9+"), completely discarding decimals.
 */
export function formatDifficultyLevel(level: number | string): string {
  if (typeof level === 'string') {
    const trimmed = level.trim();
    if (trimmed.includes('+')) return trimmed;
    const num = parseFloat(trimmed);
    if (!isNaN(num)) return formatDifficultyLevel(num);
    return trimmed;
  }
  if (isNaN(level) || level <= 1) return '1';
  const roundedInt = Math.floor(level);
  const frac = level - roundedInt;
  if (frac >= 0.4 && frac <= 0.85) {
    return `${roundedInt}+`;
  } else if (frac > 0.85) {
    return `${roundedInt + 1}`;
  } else {
    return `${roundedInt}`;
  }
}

export function clampLevel(level: number | string): string {
  return formatDifficultyLevel(level);
}

/**
 * Procedural note generator for songs/difficulties supporting tap, hold, and touch notes
 */
export function generateProceduralNotes(
  bpm: number,
  difficulty: DifficultyType,
  leadInBeats: number = 4
): Note[] {
  const beatSec = 60 / bpm;
  const beatsPerMeasure = 4;
  const leadInTime = leadInBeats * beatSec;
  const notes: Note[] = [];
  let noteId = 1;

  const add = (
    beat: number,
    type: 'tap' | 'hold' | 'touch' = 'tap',
    durationBeats: number = 0,
    touchAngleOffset: number = 0
  ) => {
    const totalBeat = leadInBeats + beat;
    const time = leadInTime + beat * beatSec;
    // For tap and hold, angle MUST precisely match the sweeping clock needle angle at this time
    const needleBaseAngle = ((totalBeat % beatsPerMeasure) / beatsPerMeasure) * 360;
    const angle = type === 'touch' ? (needleBaseAngle + touchAngleOffset) % 360 : needleBaseAngle % 360;

    const note: Note = {
      id: noteId++,
      time: Math.round(time * 1000) / 1000,
      angle: Math.round((((angle % 360) + 360) % 360) * 10) / 10,
      type,
      judged: false
    };

    if (type === 'hold' && durationBeats > 0) {
      note.duration = Math.round(durationBeats * beatSec * 1000) / 1000;
    }

    notes.push(note);
  };

  if (difficulty === 'EASY') {
    // 32 beats: relaxed quarter and half notes, gentle 1.5-beat holds, occasional touch stars
    for (let b = 0; b < 32; b += (b < 16 ? 2 : 1)) {
      if (b === 8 || b === 20 || b === 28) {
        add(b, 'hold', 1.5);
      } else if (b === 6 || b === 14 || b === 24) {
        add(b, 'touch', 0, 0);
      } else {
        add(b, 'tap', 0);
      }
    }
  } else if (difficulty === 'NORMAL') {
    // 48 beats: quarter notes, syncopated 8ths, holds, and touch stars
    let skipUntil = -1;
    for (let b = 0; b < 48; b++) {
      if (b < skipUntil) continue;

      if (b % 8 === 4) {
        // 1.5-beat hold note
        add(b, 'hold', 1.5);
        skipUntil = b + 2;
      } else if (b % 8 === 7) {
        // Touch note
        add(b, 'touch', 0, 45);
      } else {
        add(b, 'tap', 0);
        if (b % 4 === 1 || b % 4 === 3) {
          if (b % 8 === 3) {
            add(b + 0.5, 'touch', 0, 90);
          } else {
            add(b + 0.5, 'tap', 0);
          }
        }
      }
    }
  } else if (difficulty === 'HARD') {
    // 64 beats: dense 8th notes, sweeping holds, rapid touch patterns
    let skipUntil = -1;
    for (let b = 0; b < 64; b += 0.5) {
      if (b < skipUntil) continue;

      if (b % 8 === 4) {
        // 2-beat hold sweep - aligns with needle
        add(b, 'hold', 2);
        skipUntil = b + 2;
      } else if (b % 4 === 2.5) {
        // Touch star on syncopation
        add(b, 'touch', 0, 60);
      } else {
        // Fast taps
        add(b, 'tap', 0);
      }
    }
  } else if (difficulty === 'EX') {
    // 80 beats: extreme spirals, rapid 16th streams, polyrhythmic holds and touch notes
    let skipUntil = -1;
    for (let b = 0; b < 80; b += 0.25) {
      if (b < skipUntil) continue;

      if (b % 12 === 6) {
        // Long 3-beat sweeping hold
        add(b, 'hold', 3);
        skipUntil = b + 3;
      } else if (b % 2 === 1 && (b * 4) % 2 === 0) {
        // Rapid touch stars
        add(b, 'touch', 0, 45);
      } else {
        const measure = Math.floor(b / 4);
        if (measure % 2 === 0 && (b * 4) % 2 === 1) continue;
        add(b, 'tap', 0);
      }
    }
  }

  return notes.sort((a, b) => a.time - b.time);
}

/**
 * Resolves a unified ChartData for a given song and selected difficulty
 */
export function getChartDataForDifficulty(song: SongInfo, preferredDiff: DifficultyType): ChartData {
  let targetDiff = preferredDiff;

  // If preferred difficulty is not available (e.g. EX on a song without EX), fallback gracefully
  if (!song.difficulties[targetDiff]) {
    if (song.difficulties.HARD) targetDiff = 'HARD';
    else if (song.difficulties.NORMAL) targetDiff = 'NORMAL';
    else if (song.difficulties.EASY) targetDiff = 'EASY';
    else {
      const available = Object.keys(song.difficulties) as DifficultyType[];
      if (available.length > 0) targetDiff = available[0];
    }
  }

  const diffChart = song.difficulties[targetDiff] || {
    level: 5.0,
    notes: generateProceduralNotes(song.bpm, targetDiff)
  };

  const level = clampLevel(diffChart.level);
  const color = diffChart.color || DIFFICULTY_COLORS[targetDiff] || '#f39c12';
  const rotationPeriod = diffChart.rotationPeriod || song.rotationPeriod || (60 / song.bpm) * 4;
  const audioUrl = song.audioUrl || (song.id === 'bad_apple' ? 'audio/bad_apple.mp3' : song.id === 'canon_in_d' ? 'audio/canon_in_d.wav' : undefined);
  const climaxRanges = diffChart.climaxRanges || song.climaxRanges;
  const densityEvents = diffChart.densityEvents || song.densityEvents;
  const cycles = diffChart.cycles || song.cycles || 1;
  const cycleEvents = diffChart.cycleEvents || song.cycleEvents;

  return {
    id: `${song.id}_${targetDiff.toLowerCase()}`,
    title: song.title,
    artist: song.artist,
    bpm: song.bpm,
    offset: song.offset,
    rotationPeriod,
    notes: diffChart.notes,
    difficulty: targetDiff,
    level,
    color,
    cycles,
    cycleEvents,
    audioUrl,
    climaxRanges,
    densityEvents
  };
}

// Glob import of all JSON chart files from the charts folder
const chartFiles = (import.meta as any).glob('../../charts/*.json', { eager: true }) as Record<string, any>;

export function loadChartsFromFolder(): SongInfo[] {
  const songs: SongInfo[] = [];

  for (const path in chartFiles) {
    const raw = chartFiles[path]?.default || chartFiles[path];
    if (!raw || !raw.bpm) continue;

    const id = raw.id || path.replace(/.*\/|\.json$/g, '');
    const title = raw.title || 'Untitled Track';
    const artist = raw.artist || 'Unknown Artist';
    const bpm = Number(raw.bpm) || 120;
    const offset = Number(raw.offset || 0);
    const rotationPeriod = Number(raw.rotationPeriod || (60 / bpm) * 4);
    const coverColor = raw.coverColor || '#f39c12';

    const difficulties: Partial<Record<DifficultyType, DifficultyChart>> = {};

    if (raw.difficulties && typeof raw.difficulties === 'object') {
      // Multi-difficulty schema
      for (const d of DIFFICULTY_ORDER) {
        if (raw.difficulties[d]) {
          const item = raw.difficulties[d];
          difficulties[d] = {
            level: clampLevel(item.level !== undefined ? item.level : (d === 'EASY' ? 2 : d === 'HARD' ? 8 : d === 'EX' ? '9+' : 5)),
            notes: (item.notes || []).map((n: any, idx: number) => ({
              id: n.id || idx + 1,
              time: Number(n.time),
              angle: Number(n.angle),
              type: n.type || 'tap',
              duration: n.duration !== undefined ? Number(n.duration) : undefined,
              cycle: n.cycle !== undefined ? Number(n.cycle) : undefined,
              judged: false
            })).sort((a: Note, b: Note) => a.time - b.time),
            color: item.color || DIFFICULTY_COLORS[d],
            rotationPeriod: item.rotationPeriod,
            cycles: item.cycles,
            cycleEvents: item.cycleEvents
          };
        }
      }
    } else if (Array.isArray(raw.notes)) {
      // Legacy single-difficulty schema
      const diff = ((raw.difficulty || 'NORMAL').toUpperCase() as DifficultyType);
      const validDiff = DIFFICULTY_ORDER.includes(diff) ? diff : 'NORMAL';
      difficulties[validDiff] = {
        level: clampLevel(raw.level !== undefined ? raw.level : 5),
        notes: raw.notes.map((n: any, idx: number) => ({
          id: n.id || idx + 1,
          time: Number(n.time),
          angle: Number(n.angle),
          type: n.type || 'tap',
          duration: n.duration !== undefined ? Number(n.duration) : undefined,
          cycle: n.cycle !== undefined ? Number(n.cycle) : undefined,
          judged: false
        })).sort((a: Note, b: Note) => a.time - b.time),
        color: raw.color || DIFFICULTY_COLORS[validDiff],
        cycles: raw.cycles,
        cycleEvents: raw.cycleEvents
      };
    }

    // Ensure at least one difficulty exists
    if (Object.keys(difficulties).length === 0) {
      difficulties.NORMAL = {
        level: '5',
        notes: generateProceduralNotes(bpm, 'NORMAL'),
        color: DIFFICULTY_COLORS.NORMAL
      };
    }

    const audioUrl = raw.audioUrl || (
      id === 'bad_apple' ? 'audio/bad_apple.mp3' :
      id === 'canon_in_d' ? 'audio/canon_in_d.wav' : undefined
    );
    const climaxRanges = raw.climaxRanges || (
      id === 'bad_apple' ? [[14.0, 42.0], [56.0, 84.0]] :
      id === 'canon_in_d' ? [[18.0, 52.0]] : undefined
    );
    const densityEvents = raw.densityEvents;
    const cycles = raw.cycles;
    const cycleEvents = raw.cycleEvents;

    songs.push({
      id,
      title,
      artist,
      bpm,
      offset,
      rotationPeriod,
      coverColor,
      difficulties,
      cycles,
      cycleEvents,
      audioUrl,
      climaxRanges,
      densityEvents
    });
  }

  // Fallback to presets if folder empty
  if (songs.length === 0) {
    songs.push(...getPresetSongs());
  }

  return songs;
}

export function getPresetSongs(): SongInfo[] {
  return [
    {
      id: 'morning_ticking',
      title: 'Morning Ticking',
      artist: 'Cycline Chill',
      bpm: 80,
      offset: 3.0,
      rotationPeriod: 3.0,
      coverColor: '#00cec9',
      difficulties: {
        EASY: {
          level: 1.8,
          notes: generateProceduralNotes(80, 'EASY'),
          color: DIFFICULTY_COLORS.EASY
        },
        NORMAL: {
          level: 4.2,
          notes: generateProceduralNotes(80, 'NORMAL'),
          color: DIFFICULTY_COLORS.NORMAL
        },
        HARD: {
          level: 6.8,
          notes: generateProceduralNotes(80, 'HARD'),
          color: DIFFICULTY_COLORS.HARD
        },
        EX: {
          level: '8+',
          notes: generateProceduralNotes(80, 'EX'),
          color: DIFFICULTY_COLORS.EX
        }
      }
    },
    {
      id: 'clockwork_rhythm',
      title: 'Clockwork Rhythm',
      artist: 'Cycline Sound Lab',
      bpm: 120,
      offset: 2.0,
      rotationPeriod: 2.0,
      coverColor: '#0984e3',
      difficulties: {
        EASY: {
          level: 2.5,
          notes: generateProceduralNotes(120, 'EASY'),
          color: DIFFICULTY_COLORS.EASY
        },
        NORMAL: {
          level: 5.0,
          notes: generateProceduralNotes(120, 'NORMAL'),
          color: DIFFICULTY_COLORS.NORMAL
        },
        HARD: {
          level: 7.8,
          notes: generateProceduralNotes(120, 'HARD'),
          color: DIFFICULTY_COLORS.HARD
        },
        EX: {
          level: 9.2,
          notes: generateProceduralNotes(120, 'EX'),
          color: DIFFICULTY_COLORS.EX
        }
      }
    },
    {
      id: 'overclocked_orbit',
      title: 'Overclocked Orbit',
      artist: 'Cycline Rush',
      bpm: 160,
      offset: 1.5,
      rotationPeriod: 1.5,
      coverColor: '#2e86de',
      difficulties: {
        EASY: {
          level: 3.5,
          notes: generateProceduralNotes(160, 'EASY'),
          color: DIFFICULTY_COLORS.EASY
        },
        NORMAL: {
          level: 6.2,
          notes: generateProceduralNotes(160, 'NORMAL'),
          color: DIFFICULTY_COLORS.NORMAL
        },
        HARD: {
          level: 8.6,
          notes: generateProceduralNotes(160, 'HARD'),
          color: DIFFICULTY_COLORS.HARD
        },
        EX: {
          level: 9.8,
          notes: generateProceduralNotes(160, 'EX'),
          color: DIFFICULTY_COLORS.EX
        }
      }
    }
  ];
}

export function exportSongToJson(song: SongInfo): string {
  return JSON.stringify(song, null, 2);
}

export function importSongFromJson(jsonStr: string): SongInfo {
  const data = JSON.parse(jsonStr);
  if (!data.bpm) {
    throw new Error('Invalid chart file: missing BPM');
  }

  const id = data.id || 'custom_' + Date.now();
  const title = data.title || 'Custom Track';
  const artist = data.artist || 'Custom Artist';
  const bpm = Number(data.bpm);
  const offset = Number(data.offset || 0);
  const rotationPeriod = Number(data.rotationPeriod || (60 / bpm) * 4);
  const coverColor = data.coverColor || '#f39c12';

  const difficulties: Partial<Record<DifficultyType, DifficultyChart>> = {};

  if (data.difficulties && typeof data.difficulties === 'object') {
    for (const d of DIFFICULTY_ORDER) {
      if (data.difficulties[d]) {
        const item = data.difficulties[d];
        difficulties[d] = {
          level: clampLevel(Number(item.level || 5)),
          notes: (item.notes || []).map((n: any, idx: number) => ({
            id: n.id || idx + 1,
            time: Number(n.time),
            angle: Number(n.angle),
            type: n.type || 'tap',
            duration: n.duration !== undefined ? Number(n.duration) : undefined,
            judged: false
          })).sort((a: Note, b: Note) => a.time - b.time),
          color: item.color || DIFFICULTY_COLORS[d],
          rotationPeriod: item.rotationPeriod
        };
      }
    }
  } else if (Array.isArray(data.notes)) {
    const diff = ((data.difficulty || 'NORMAL').toUpperCase() as DifficultyType);
    const validDiff = DIFFICULTY_ORDER.includes(diff) ? diff : 'NORMAL';
    difficulties[validDiff] = {
      level: clampLevel(Number(data.level || 5)),
      notes: data.notes.map((n: any, idx: number) => ({
        id: n.id || idx + 1,
        time: Number(n.time),
        angle: Number(n.angle),
        type: n.type || 'tap',
        duration: n.duration !== undefined ? Number(n.duration) : undefined,
        judged: false
      })).sort((a: Note, b: Note) => a.time - b.time),
      color: data.color || DIFFICULTY_COLORS[validDiff]
    };
  }

  if (Object.keys(difficulties).length === 0) {
    difficulties.NORMAL = {
      level: 5.0,
      notes: generateProceduralNotes(bpm, 'NORMAL'),
      color: DIFFICULTY_COLORS.NORMAL
    };
  }

  return {
    id,
    title,
    artist,
    bpm,
    offset,
    rotationPeriod,
    coverColor,
    difficulties
  };
}
