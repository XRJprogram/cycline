import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const chartsDir = path.resolve(__dirname, '../charts');

const DIFFICULTY_COLORS = {
  EASY: '#00cec9',
  NORMAL: '#0984e3',
  HARD: '#2e86de',
  EX: '#5f27cd'
};

function generateProceduralNotes(bpm, difficulty, leadInBeats = 4) {
  const beatSec = 60 / bpm;
  const beatsPerMeasure = 4;
  const leadInTime = leadInBeats * beatSec;
  const notes = [];
  let noteId = 1;

  const add = (
    beat,
    type = 'tap',
    durationBeats = 0,
    touchAngleOffset = 0
  ) => {
    const totalBeat = leadInBeats + beat;
    const time = leadInTime + beat * beatSec;
    // For tap and hold, angle MUST precisely match the sweeping clock needle angle at this time
    const needleBaseAngle = ((totalBeat % beatsPerMeasure) / beatsPerMeasure) * 360;
    const angle = type === 'touch' ? (needleBaseAngle + touchAngleOffset) % 360 : needleBaseAngle % 360;

    const note = {
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
    let skipUntil = -1;
    for (let b = 0; b < 48; b++) {
      if (b < skipUntil) continue;

      if (b % 8 === 4) {
        add(b, 'hold', 1.5);
        skipUntil = b + 2;
      } else if (b % 8 === 7) {
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
    let skipUntil = -1;
    for (let b = 0; b < 64; b += 0.5) {
      if (b < skipUntil) continue;

      if (b % 8 === 4) {
        add(b, 'hold', 2);
        skipUntil = b + 2;
      } else if (b % 4 === 2.5) {
        add(b, 'touch', 0, 60);
      } else {
        add(b, 'tap', 0);
      }
    }
  } else if (difficulty === 'EX') {
    let skipUntil = -1;
    for (let b = 0; b < 80; b += 0.25) {
      if (b < skipUntil) continue;

      if (b % 12 === 6) {
        add(b, 'hold', 3);
        skipUntil = b + 3;
      } else if (b % 2 === 1 && (b * 4) % 2 === 0) {
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

const songs = [
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

for (const song of songs) {
  const filePath = path.join(chartsDir, `${song.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(song, null, 2), 'utf-8');
  console.log(`Generated: ${filePath}`);
}
