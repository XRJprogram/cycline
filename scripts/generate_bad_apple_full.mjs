import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const chartsDir = path.resolve(__dirname, '..', 'charts');

const BPM = 138;
const BEAT_SEC = 60 / BPM; // ~0.4347826s
const MEASURE_SEC = BEAT_SEC * 4; // ~1.7391304s
const ROTATION_PERIOD = 1.739;
const AUDIO_OFFSET = 1.312;
const TOTAL_MEASURES = 124; // Up to ~217 seconds (covers full 219s audio)

function round3(num) {
  return Math.round(num * 1000) / 1000;
}

function buildBadAppleFull() {
  const easyNotes = [];
  const normalNotes = [];
  const hardNotes = [];
  const exNotes = [];

  function addNote(list, idGen, m, beat, type = 'tap', durationBeats = 0) {
    const time = round3(m * MEASURE_SEC + beat * BEAT_SEC);
    const angle = round3(((beat % 4) / 4) * 360);
    const note = {
      id: idGen.val++,
      time,
      angle,
      type,
      judged: false
    };
    if (type === 'hold' && durationBeats > 0) {
      note.duration = round3(durationBeats * BEAT_SEC);
    }
    list.push(note);
    return note;
  }

  const idEasy = { val: 1 };
  const idNorm = { val: 1 };
  const idHard = { val: 1 };
  const idEx = { val: 1 };

  for (let m = 0; m < TOTAL_MEASURES; m++) {
    // ---------------------------------------------------------
    // SECTION 1: INTRO SYNTH (M0 - M7, 0.0s - 13.9s)
    // ---------------------------------------------------------
    if (m < 8) {
      // Measures 0 & 1 (0.0s - 3.478s): Lead-in waiting time (2 full needle revolutions)!
      // The needle rotates smoothly from 12 o'clock, synth intro plays, and upcoming notes appear.
      // Gameplay notes begin at Measure 2 (3.478s) for EX/HARD/NORMAL, and Measure 4 (6.957s) for EASY.
      if (m < 2) {
        // Pure musical lead-in
      } else if (m % 2 === 0) {
        // Bar 1 of motif: 0, 1, 2, 3
        addNote(exNotes, idEx, m, 0, 'tap');
        addNote(exNotes, idEx, m, 1, 'tap');
        addNote(exNotes, idEx, m, 2, 'tap');
        addNote(exNotes, idEx, m, 2.5, 'touch');
        addNote(exNotes, idEx, m, 3, 'tap');

        addNote(hardNotes, idHard, m, 0, 'tap');
        addNote(hardNotes, idHard, m, 2, 'tap');

        addNote(normalNotes, idNorm, m, 0, 'tap');
        addNote(normalNotes, idNorm, m, 2, 'tap');

        if (m >= 4) addNote(easyNotes, idEasy, m, 0, 'tap');
      } else {
        // Bar 2 of motif: 0, 1, 1.5, 2, 2.5, 3 (syncopation)
        addNote(exNotes, idEx, m, 0, 'tap');
        addNote(exNotes, idEx, m, 1, 'tap');
        addNote(exNotes, idEx, m, 1.5, 'touch');
        addNote(exNotes, idEx, m, 2, 'tap');
        addNote(exNotes, idEx, m, 2.5, 'touch');
        addNote(exNotes, idEx, m, 3, 'tap');
        addNote(exNotes, idEx, m, 3.5, 'touch');

        addNote(hardNotes, idHard, m, 0, 'tap');
        addNote(hardNotes, idHard, m, 2, 'tap');
        addNote(hardNotes, idHard, m, 3, 'tap');

        addNote(normalNotes, idNorm, m, 0, 'tap');
        addNote(normalNotes, idNorm, m, 2, 'tap');

        if (m >= 4) addNote(easyNotes, idEasy, m, 0, 'tap');
      }
    }

    // ---------------------------------------------------------
    // SECTION 2: INTRO DRUMS IN (M8 - M15, 13.9s - 27.8s)
    // ---------------------------------------------------------
    else if (m < 16) {
      // 4-on-the-floor kick on beats 0, 1, 2, 3; snare on 1 & 3; hi-hats on 8ths
      for (let b = 0; b < 4; b++) {
        addNote(exNotes, idEx, m, b, 'tap');
        addNote(hardNotes, idHard, m, b, 'tap');
        addNote(normalNotes, idNorm, m, b, 'tap');
      }
      // Off-beat touch stars on hi-hats
      addNote(exNotes, idEx, m, 0.5, 'touch');
      addNote(exNotes, idEx, m, 1.5, 'touch');
      addNote(exNotes, idEx, m, 2.5, 'touch');
      addNote(exNotes, idEx, m, 3.5, 'touch');

      if (m % 2 === 1) {
        addNote(hardNotes, idHard, m, 3.5, 'touch');
      }
      // Easy: strong downbeats 0 and 2
      addNote(easyNotes, idEasy, m, 0, 'tap');
      addNote(easyNotes, idEasy, m, 2, 'tap');

      // Drum fill on M15: 16th stream roll
      if (m === 15) {
        for (let b = 2.0; b <= 3.75; b += 0.25) {
          addNote(exNotes, idEx, m, b, (b * 4) % 2 === 0 ? 'tap' : 'touch');
        }
      }
    }

    // ---------------------------------------------------------
    // SECTION 3: VERSE 1A (M16 - M23, 27.8s - 41.7s)
    // Nomico Vocals: "Nagareteku toki no naka de demo..."
    // ---------------------------------------------------------
    else if (m < 24) {
      const phraseMod = m % 4;
      if (phraseMod === 0) {
        // "Nagareteku toki no naka de"
        for (let b = 0; b < 3.5; b += 0.5) {
          addNote(exNotes, idEx, m, b, b % 1 === 0 ? 'tap' : 'touch');
          if (b % 1 === 0 || b === 1.5) addNote(hardNotes, idHard, m, b, 'tap');
        }
        addNote(normalNotes, idNorm, m, 0, 'tap');
        addNote(normalNotes, idNorm, m, 1, 'tap');
        addNote(normalNotes, idNorm, m, 2, 'tap');
        addNote(easyNotes, idEasy, m, 0, 'tap');
        addNote(easyNotes, idEasy, m, 2, 'tap');
      } else if (phraseMod === 1) {
        // "demo~~~" Multi-cycle sweeping hold (lasts 6.0 beats = 1.5 cycles)!
        addNote(exNotes, idEx, m, 0, 'hold', 6.0);
        addNote(hardNotes, idHard, m, 0, 'hold', 2.0);
        addNote(normalNotes, idNorm, m, 0, 'hold', 2.0);
        addNote(easyNotes, idEasy, m, 0, 'hold', 2.0);

        // Counter-melody touches while sweeping hold is sustained
        addNote(exNotes, idEx, m, 2.5, 'touch');
        addNote(exNotes, idEx, m, 3.0, 'tap');
        addNote(exNotes, idEx, m, 3.5, 'touch');
        addNote(hardNotes, idHard, m, 3.0, 'tap');
        addNote(normalNotes, idNorm, m, 3.0, 'tap');
      } else if (phraseMod === 2) {
        // "Kedarusa ga hora guruguru" - 16th syncopated stream
        for (let b = 0; b < 4; b += 0.5) {
          addNote(exNotes, idEx, m, b, b % 1 === 0 ? 'tap' : 'touch');
          if (b % 1 === 0) addNote(hardNotes, idHard, m, b, 'tap');
        }
        addNote(exNotes, idEx, m, 1.25, 'touch');
        addNote(exNotes, idEx, m, 3.25, 'touch');

        addNote(normalNotes, idNorm, m, 0, 'tap');
        addNote(normalNotes, idNorm, m, 2, 'tap');
        addNote(easyNotes, idEasy, m, 0, 'tap');
      } else {
        // "mawatte~~~" Multi-cycle hold sweep (6.0 beats = 1.5 cycles)
        addNote(exNotes, idEx, m, 0, 'hold', 6.0);
        addNote(hardNotes, idHard, m, 0, 'hold', 2.0);
        addNote(normalNotes, idNorm, m, 0, 'hold', 2.0);
        addNote(easyNotes, idEasy, m, 0, 'hold', 2.0);

        addNote(exNotes, idEx, m, 2.5, 'tap');
        addNote(exNotes, idEx, m, 3.0, 'tap');
        addNote(exNotes, idEx, m, 3.5, 'touch');
        addNote(hardNotes, idHard, m, 2.5, 'tap');
        addNote(hardNotes, idHard, m, 3.5, 'touch');
        addNote(normalNotes, idNorm, m, 3.0, 'tap');
      }
    }

    // ---------------------------------------------------------
    // SECTION 4: VERSE 1B (M24 - M31, 41.7s - 55.7s)
    // "Watashi kara ugoku koto mo naku..."
    // ---------------------------------------------------------
    else if (m < 32) {
      const phraseMod = m % 4;
      if (phraseMod === 0 || phraseMod === 2) {
        for (let b = 0; b < 4; b += 0.5) {
          const type = (b === 1.5 || b === 3.5) ? 'touch' : 'tap';
          addNote(exNotes, idEx, m, b, type);
          if (b % 1 === 0) addNote(hardNotes, idHard, m, b, 'tap');
        }
        addNote(exNotes, idEx, m, 0.75, 'touch');
        addNote(exNotes, idEx, m, 2.75, 'touch');

        addNote(hardNotes, idHard, m, 1.5, 'touch');
        addNote(normalNotes, idNorm, m, 0, 'tap');
        addNote(normalNotes, idNorm, m, 2, 'tap');
        addNote(easyNotes, idEasy, m, 0, 'tap');
      } else if (phraseMod === 1) {
        // Sustained vocal hold spanning 6.0 beats across cycles!
        addNote(exNotes, idEx, m, 0, 'hold', 6.0);
        addNote(hardNotes, idHard, m, 0, 'hold', 2.0);
        addNote(normalNotes, idNorm, m, 0, 'hold', 2.0);
        addNote(easyNotes, idEasy, m, 0, 'hold', 2.0);

        addNote(exNotes, idEx, m, 2.25, 'touch');
        addNote(exNotes, idEx, m, 2.5, 'tap');
        addNote(exNotes, idEx, m, 3.0, 'tap');
        addNote(exNotes, idEx, m, 3.5, 'touch');
        addNote(hardNotes, idHard, m, 2.5, 'tap');
        addNote(normalNotes, idNorm, m, 3.0, 'tap');
      } else {
        // Transition into pre-chorus
        for (let b = 0; b < 4; b++) {
          addNote(exNotes, idEx, m, b, 'tap');
          addNote(hardNotes, idHard, m, b, 'tap');
          addNote(normalNotes, idNorm, m, b, 'tap');
        }
        addNote(exNotes, idEx, m, 0.5, 'touch');
        addNote(exNotes, idEx, m, 1.5, 'touch');
        addNote(exNotes, idEx, m, 2.5, 'touch');
        addNote(exNotes, idEx, m, 3.5, 'touch');
        addNote(easyNotes, idEasy, m, 0, 'tap');
        addNote(easyNotes, idEasy, m, 2, 'tap');
      }
    }

    // ---------------------------------------------------------
    // SECTION 5: PRE-CHORUS 1 / BUILD-UP (M32 - M39, 55.7s - 69.6s)
    // Track unfurls: density = 0.65 reveals 2 full cycles!
    // ---------------------------------------------------------
    else if (m < 40) {
      if (m < 36) {
        // Driving 8th snare pattern + 16th syncopations
        for (let b = 0; b < 4; b += 0.5) {
          addNote(exNotes, idEx, m, b, b % 1 === 0 ? 'tap' : 'touch');
          if (b % 1 === 0) addNote(hardNotes, idHard, m, b, 'tap');
          if (b === 1.5 || b === 3.5) addNote(hardNotes, idHard, m, b, 'touch');
        }
        addNote(exNotes, idEx, m, 1.25, 'touch');
        addNote(exNotes, idEx, m, 3.25, 'touch');

        addNote(normalNotes, idNorm, m, 0, 'tap');
        addNote(normalNotes, idNorm, m, 1, 'tap');
        addNote(normalNotes, idNorm, m, 2, 'tap');
        addNote(normalNotes, idNorm, m, 3, 'tap');
        addNote(easyNotes, idEasy, m, 0, 'tap');
        addNote(easyNotes, idEasy, m, 2, 'tap');
      } else if (m < 39) {
        // 16th-note spiraling waterfall stream across the 2-cycle track!
        for (let b = 0; b < 4; b += 0.25) {
          addNote(exNotes, idEx, m, b, (b * 4) % 2 === 0 ? 'tap' : 'touch');
        }
        for (let b = 0; b < 4; b += 0.5) {
          addNote(hardNotes, idHard, m, b, b % 1 === 0 ? 'tap' : 'touch');
        }
        for (let b = 0; b < 4; b++) {
          addNote(normalNotes, idNorm, m, b, 'tap');
        }
        addNote(easyNotes, idEasy, m, 0, 'tap');
        addNote(easyNotes, idEasy, m, 2, 'tap');
      } else {
        // Dramatic final buildup measure before drop! Gap at 3.5
        for (let b = 0; b <= 3.25; b += 0.25) {
          addNote(exNotes, idEx, m, b, b === 3.25 ? 'touch' : 'tap');
        }
        for (let b = 0; b <= 3.0; b += 0.5) {
          addNote(hardNotes, idHard, m, b, 'tap');
        }
        for (let b = 0; b <= 3.0; b++) {
          addNote(normalNotes, idNorm, m, b, 'tap');
        }
        addNote(easyNotes, idEasy, m, 0, 'tap');
        addNote(easyNotes, idEasy, m, 2, 'tap');
      }
    }

    // ---------------------------------------------------------
    // SECTION 6: CHORUS 1 (M40 - M47, 69.6s - 83.5s) - CLIMAX 1
    // "Yume mo miru koto mo naku..."
    // Multi-cycle sweeps (540° ~ 630° rotation) + Fourier track wave
    // ---------------------------------------------------------
    else if (m < 48) {
      const phraseMod = m % 4;
      if (phraseMod === 0) {
        // Drop chord + sweeping hold across 7.0 beats (1.75 cycles)!
        addNote(exNotes, idEx, m, 0, 'hold', 7.0);
        addNote(hardNotes, idHard, m, 0, 'hold', 2.0);
        addNote(normalNotes, idNorm, m, 0, 'hold', 2.0);
        addNote(easyNotes, idEasy, m, 0, 'hold', 2.0);

        // Counter-melody touches firing along opposite quadrants while holding!
        addNote(exNotes, idEx, m, 2.0, 'tap');
        addNote(exNotes, idEx, m, 2.5, 'touch');
        addNote(exNotes, idEx, m, 3.0, 'tap');
        addNote(exNotes, idEx, m, 3.5, 'touch');
        addNote(hardNotes, idHard, m, 2.5, 'touch');
        addNote(hardNotes, idHard, m, 3.0, 'tap');
        addNote(normalNotes, idNorm, m, 3.0, 'tap');
      } else if (phraseMod === 1) {
        // Driving vocal stream + 16th polyrhythmic burst
        for (let b = 0; b < 4; b += 0.5) {
          addNote(exNotes, idEx, m, b, (b === 1.5 || b === 3.5) ? 'touch' : 'tap');
          if (b % 1 === 0 || b === 1.5) addNote(hardNotes, idHard, m, b, 'tap');
        }
        addNote(exNotes, idEx, m, 0.75, 'touch');
        addNote(exNotes, idEx, m, 2.75, 'touch');

        for (let b = 0; b < 4; b++) {
          addNote(normalNotes, idNorm, m, b, 'tap');
        }
        addNote(easyNotes, idEasy, m, 0, 'tap');
        addNote(easyNotes, idEasy, m, 2, 'tap');
      } else if (phraseMod === 2) {
        // Second vocal peak hold: 7.0 beats (1.75 revolutions)
        addNote(exNotes, idEx, m, 0, 'hold', 7.0);
        addNote(hardNotes, idHard, m, 0, 'hold', 2.0);
        addNote(normalNotes, idNorm, m, 0, 'hold', 2.0);
        addNote(easyNotes, idEasy, m, 0, 'hold', 2.0);

        addNote(exNotes, idEx, m, 2.0, 'tap');
        addNote(exNotes, idEx, m, 2.5, 'touch');
        addNote(exNotes, idEx, m, 3.0, 'tap');
        addNote(exNotes, idEx, m, 3.5, 'touch');
        addNote(hardNotes, idHard, m, 2.5, 'tap');
        addNote(normalNotes, idNorm, m, 3.0, 'tap');
      } else {
        // Chorus conclusion phrase: 16th stream arpeggio
        for (let b = 0; b < 4; b += 0.5) {
          addNote(exNotes, idEx, m, b, b % 1 === 0 ? 'tap' : 'touch');
          if (b % 1 === 0) addNote(hardNotes, idHard, m, b, 'tap');
        }
        addNote(exNotes, idEx, m, 1.25, 'touch');
        addNote(exNotes, idEx, m, 3.25, 'touch');
        addNote(hardNotes, idHard, m, 3.5, 'touch');

        for (let b = 0; b < 4; b++) {
          addNote(normalNotes, idNorm, m, b, 'tap');
        }
        addNote(easyNotes, idEasy, m, 0, 'tap');
        addNote(easyNotes, idEasy, m, 2, 'tap');
      }
    }

    // ---------------------------------------------------------
    // SECTION 7: POST-CHORUS / INTERLUDE (M48 - M55, 83.5s - 97.4s)
    // Funk-inspired synth stabs, syncopated rhythm
    // ---------------------------------------------------------
    else if (m < 56) {
      // Syncopated stabs on beats 0, 0.75, 1.5, 2.25, 3.0
      addNote(exNotes, idEx, m, 0, 'tap');
      addNote(exNotes, idEx, m, 0.75, 'touch');
      addNote(exNotes, idEx, m, 1.0, 'tap');
      addNote(exNotes, idEx, m, 1.5, 'touch');
      addNote(exNotes, idEx, m, 2.25, 'touch');
      addNote(exNotes, idEx, m, 2.5, 'touch');
      addNote(exNotes, idEx, m, 3.0, 'tap');

      addNote(hardNotes, idHard, m, 0, 'tap');
      addNote(hardNotes, idHard, m, 1.5, 'touch');
      addNote(hardNotes, idHard, m, 2.5, 'touch');
      addNote(hardNotes, idHard, m, 3.0, 'tap');

      addNote(normalNotes, idNorm, m, 0, 'tap');
      addNote(normalNotes, idNorm, m, 2, 'tap');

      if (m % 2 === 0) addNote(easyNotes, idEasy, m, 0, 'tap');
    }

    // ---------------------------------------------------------
    // SECTION 8: SYNTH LEAD SOLO (M56 - M63, 97.4s - 111.3s)
    // High-speed 2-cycle melodic arpeggio streams
    // ---------------------------------------------------------
    else if (m < 64) {
      if (m % 4 === 3) {
        // End of phrase multi-cycle hold (6.0 beats)
        addNote(exNotes, idEx, m, 0, 'hold', 6.0);
        addNote(hardNotes, idHard, m, 0, 'hold', 2.0);
        addNote(normalNotes, idNorm, m, 0, 'hold', 2.0);
        addNote(easyNotes, idEasy, m, 0, 'hold', 2.0);

        addNote(exNotes, idEx, m, 2.5, 'touch');
        addNote(exNotes, idEx, m, 3.0, 'tap');
        addNote(exNotes, idEx, m, 3.5, 'touch');
        addNote(hardNotes, idHard, m, 3.0, 'tap');
        addNote(normalNotes, idNorm, m, 3.0, 'tap');
      } else {
        // Fast 16th melodic arpeggio waterfall
        for (let b = 0; b < 4; b += 0.25) {
          const type = (b * 4) % 2 === 1 ? 'touch' : 'tap';
          addNote(exNotes, idEx, m, b, type);
        }
        for (let b = 0; b < 4; b += 0.5) {
          addNote(hardNotes, idHard, m, b, b % 1 === 0 ? 'tap' : 'touch');
        }
        for (let b = 0; b < 4; b++) {
          addNote(normalNotes, idNorm, m, b, 'tap');
        }
        addNote(easyNotes, idEasy, m, 0, 'tap');
        addNote(easyNotes, idEasy, m, 2, 'tap');
      }
    }

    // ---------------------------------------------------------
    // SECTION 9: VERSE 2A (M64 - M71, 111.3s - 125.2s)
    // "Ugoku no nara subete o kowashite..."
    // ---------------------------------------------------------
    else if (m < 72) {
      const phraseMod = m % 4;
      if (phraseMod === 0) {
        for (let b = 0; b < 3.5; b += 0.5) {
          addNote(exNotes, idEx, m, b, b % 1 === 0 ? 'tap' : 'touch');
          if (b % 1 === 0) addNote(hardNotes, idHard, m, b, 'tap');
        }
        addNote(exNotes, idEx, m, 1.25, 'touch');
        addNote(normalNotes, idNorm, m, 0, 'tap');
        addNote(normalNotes, idNorm, m, 2, 'tap');
        addNote(easyNotes, idEasy, m, 0, 'tap');
      } else if (phraseMod === 1) {
        addNote(exNotes, idEx, m, 0, 'hold', 6.0);
        addNote(hardNotes, idHard, m, 0, 'hold', 2.0);
        addNote(normalNotes, idNorm, m, 0, 'hold', 2.0);
        addNote(easyNotes, idEasy, m, 0, 'hold', 2.0);

        addNote(exNotes, idEx, m, 2.5, 'touch');
        addNote(exNotes, idEx, m, 3.0, 'tap');
        addNote(exNotes, idEx, m, 3.5, 'touch');
        addNote(hardNotes, idHard, m, 3.0, 'tap');
        addNote(normalNotes, idNorm, m, 3.0, 'tap');
      } else if (phraseMod === 2) {
        for (let b = 0; b < 4; b += 0.5) {
          addNote(exNotes, idEx, m, b, b % 1 === 0 ? 'tap' : 'touch');
          if (b % 1 === 0 || b === 1.5) addNote(hardNotes, idHard, m, b, 'tap');
        }
        addNote(exNotes, idEx, m, 2.25, 'touch');
        addNote(normalNotes, idNorm, m, 0, 'tap');
        addNote(normalNotes, idNorm, m, 2, 'tap');
        addNote(easyNotes, idEasy, m, 0, 'tap');
      } else {
        addNote(exNotes, idEx, m, 0, 'hold', 6.0);
        addNote(hardNotes, idHard, m, 0, 'hold', 2.0);
        addNote(normalNotes, idNorm, m, 0, 'hold', 2.0);
        addNote(easyNotes, idEasy, m, 0, 'hold', 2.0);

        addNote(exNotes, idEx, m, 2.5, 'tap');
        addNote(exNotes, idEx, m, 3.0, 'tap');
        addNote(exNotes, idEx, m, 3.5, 'touch');
        addNote(hardNotes, idHard, m, 2.5, 'tap');
        addNote(normalNotes, idNorm, m, 3.0, 'tap');
      }
    }

    // ---------------------------------------------------------
    // SECTION 10: VERSE 2B (M72 - M79, 125.2s - 139.1s)
    // "Kuroku somaru kokoro no naka de..."
    // ---------------------------------------------------------
    else if (m < 80) {
      for (let b = 0; b < 4; b += 0.5) {
        const type = (b === 1.5 || b === 3.5) ? 'touch' : 'tap';
        addNote(exNotes, idEx, m, b, type);
        if (b % 1 === 0) addNote(hardNotes, idHard, m, b, 'tap');
      }
      addNote(exNotes, idEx, m, 0.75, 'touch');
      addNote(exNotes, idEx, m, 2.75, 'touch');
      addNote(hardNotes, idHard, m, 1.5, 'touch');
      addNote(normalNotes, idNorm, m, 0, 'tap');
      addNote(normalNotes, idNorm, m, 2, 'tap');
      addNote(easyNotes, idEasy, m, 0, 'tap');
      addNote(easyNotes, idEasy, m, 2, 'tap');
    }

    // ---------------------------------------------------------
    // SECTION 11: PRE-CHORUS 2 / GRAND BUILD-UP (M80 - M87, 139.1s - 153.0s)
    // High tension crescendo into the final drop
    // ---------------------------------------------------------
    else if (m < 88) {
      if (m < 84) {
        for (let b = 0; b < 4; b += 0.5) {
          addNote(exNotes, idEx, m, b, b % 1 === 0 ? 'tap' : 'touch');
          if (b % 1 === 0) addNote(hardNotes, idHard, m, b, 'tap');
          if (b === 1.5 || b === 3.5) addNote(hardNotes, idHard, m, b, 'touch');
        }
        addNote(exNotes, idEx, m, 1.25, 'touch');
        addNote(exNotes, idEx, m, 3.25, 'touch');
        for (let b = 0; b < 4; b++) {
          addNote(normalNotes, idNorm, m, b, 'tap');
        }
        addNote(easyNotes, idEasy, m, 0, 'tap');
        addNote(easyNotes, idEasy, m, 2, 'tap');
      } else if (m < 87) {
        // Accelerating 16th stream rolls
        for (let b = 0; b < 4; b += 0.25) {
          addNote(exNotes, idEx, m, b, (b * 4) % 2 === 0 ? 'tap' : 'touch');
        }
        for (let b = 0; b < 4; b += 0.5) {
          addNote(hardNotes, idHard, m, b, b % 1 === 0 ? 'tap' : 'touch');
        }
        for (let b = 0; b < 4; b++) {
          addNote(normalNotes, idNorm, m, b, 'tap');
        }
        addNote(easyNotes, idEasy, m, 0, 'tap');
        addNote(easyNotes, idEasy, m, 2, 'tap');
      } else {
        // Dramatic drop measure before grand climax
        for (let b = 0; b <= 3.25; b += 0.25) {
          addNote(exNotes, idEx, m, b, b === 3.25 ? 'touch' : 'tap');
        }
        for (let b = 0; b <= 3.0; b += 0.5) {
          addNote(hardNotes, idHard, m, b, 'tap');
        }
        for (let b = 0; b <= 3.0; b++) {
          addNote(normalNotes, idNorm, m, b, 'tap');
        }
        addNote(easyNotes, idEasy, m, 0, 'tap');
        addNote(easyNotes, idEasy, m, 2, 'tap');
      }
    }

    // ---------------------------------------------------------
    // SECTION 12: CHORUS 2 (M88 - M95, 153.0s - 167.0s) - GRAND CLIMAX
    // "Kokoro o kowashite someru nara..."
    // 2-cycle grand sweeping holds (7.5 beats) & polyrhythmic bursts
    // ---------------------------------------------------------
    else if (m < 96) {
      const phraseMod = m % 4;
      if (phraseMod === 0) {
        // 7.5 beats sweeping hold (~1.875 cycles)!
        addNote(exNotes, idEx, m, 0, 'hold', 7.5);
        addNote(hardNotes, idHard, m, 0, 'hold', 2.0);
        addNote(normalNotes, idNorm, m, 0, 'hold', 2.0);
        addNote(easyNotes, idEasy, m, 0, 'hold', 2.0);

        addNote(exNotes, idEx, m, 2.0, 'tap');
        addNote(exNotes, idEx, m, 2.25, 'touch');
        addNote(exNotes, idEx, m, 2.75, 'touch');
        addNote(exNotes, idEx, m, 3.0, 'tap');
        addNote(exNotes, idEx, m, 3.5, 'touch');
        addNote(hardNotes, idHard, m, 2.5, 'touch');
        addNote(hardNotes, idHard, m, 3.0, 'tap');
        addNote(normalNotes, idNorm, m, 3.0, 'tap');
      } else if (phraseMod === 1) {
        for (let b = 0; b < 4; b += 0.5) {
          addNote(exNotes, idEx, m, b, (b === 1.5 || b === 3.5) ? 'touch' : 'tap');
          if (b % 1 === 0 || b === 1.5) addNote(hardNotes, idHard, m, b, 'tap');
        }
        addNote(exNotes, idEx, m, 0.75, 'touch');
        addNote(exNotes, idEx, m, 2.75, 'touch');

        for (let b = 0; b < 4; b++) {
          addNote(normalNotes, idNorm, m, b, 'tap');
        }
        addNote(easyNotes, idEasy, m, 0, 'tap');
        addNote(easyNotes, idEasy, m, 2, 'tap');
      } else if (phraseMod === 2) {
        // Second grand vocal hold: 7.5 beats
        addNote(exNotes, idEx, m, 0, 'hold', 7.5);
        addNote(hardNotes, idHard, m, 0, 'hold', 2.0);
        addNote(normalNotes, idNorm, m, 0, 'hold', 2.0);
        addNote(easyNotes, idEasy, m, 0, 'hold', 2.0);

        addNote(exNotes, idEx, m, 2.0, 'tap');
        addNote(exNotes, idEx, m, 2.5, 'tap');
        addNote(exNotes, idEx, m, 3.0, 'tap');
        addNote(exNotes, idEx, m, 3.5, 'touch');
        addNote(hardNotes, idHard, m, 2.5, 'tap');
        addNote(normalNotes, idNorm, m, 3.0, 'tap');
      } else {
        // 16th stream waterfall into chorus extension
        for (let b = 0; b < 4; b += 0.25) {
          const type = (b * 4) % 2 === 1 ? 'touch' : 'tap';
          addNote(exNotes, idEx, m, b, type);
        }
        for (let b = 0; b < 4; b += 0.5) {
          if (b % 1 === 0) addNote(hardNotes, idHard, m, b, 'tap');
        }
        addNote(hardNotes, idHard, m, 3.5, 'touch');
        for (let b = 0; b < 4; b++) {
          addNote(normalNotes, idNorm, m, b, 'tap');
        }
        addNote(easyNotes, idEasy, m, 0, 'tap');
        addNote(easyNotes, idEasy, m, 2, 'tap');
      }
    }

    // ---------------------------------------------------------
    // SECTION 13: CHORUS 2 EXTENSION (M96 - M103, 167.0s - 180.9s)
    // "Shiroku shiroku someru... subete ga owaru made..."
    // Full 2-cycle 8.0-beat holds (720° double-revolution)
    // ---------------------------------------------------------
    else if (m < 104) {
      const phraseMod = m % 4;
      if (phraseMod === 0 || phraseMod === 2) {
        // Full 2-cycle hold (8.0 beats = 720 degrees)!
        addNote(exNotes, idEx, m, 0, 'hold', 8.0);
        addNote(hardNotes, idHard, m, 0, 'hold', 2.0);
        addNote(normalNotes, idNorm, m, 0, 'hold', 2.0);
        addNote(easyNotes, idEasy, m, 0, 'hold', 2.0);

        addNote(exNotes, idEx, m, 2.25, 'touch');
        addNote(exNotes, idEx, m, 2.75, 'touch');
        addNote(exNotes, idEx, m, 3.0, 'tap');
        addNote(exNotes, idEx, m, 3.5, 'touch');
        addNote(hardNotes, idHard, m, 3.0, 'tap');
        addNote(normalNotes, idNorm, m, 3.0, 'tap');
      } else {
        for (let b = 0; b < 4; b += 0.5) {
          addNote(exNotes, idEx, m, b, b % 1 === 0 ? 'tap' : 'touch');
          if (b % 1 === 0 || b === 1.5) addNote(hardNotes, idHard, m, b, 'tap');
        }
        addNote(exNotes, idEx, m, 0.75, 'touch');
        addNote(exNotes, idEx, m, 2.75, 'touch');

        for (let b = 0; b < 4; b++) {
          addNote(normalNotes, idNorm, m, b, 'tap');
        }
        addNote(easyNotes, idEasy, m, 0, 'tap');
        addNote(easyNotes, idEasy, m, 2, 'tap');
      }
    }

    // ---------------------------------------------------------
    // SECTION 14: OUTRO SYNTH REPRISE (M104 - M111, 180.9s - 194.8s)
    // Iconic lead synth motif returns with driving drums
    // ---------------------------------------------------------
    else if (m < 112) {
      for (let b = 0; b < 4; b++) {
        addNote(exNotes, idEx, m, b, 'tap');
        addNote(hardNotes, idHard, m, b, 'tap');
        addNote(normalNotes, idNorm, m, b, 'tap');
      }
      addNote(exNotes, idEx, m, 0.5, 'touch');
      addNote(exNotes, idEx, m, 1.5, 'touch');
      addNote(exNotes, idEx, m, 2.5, 'touch');
      addNote(exNotes, idEx, m, 3.5, 'touch');
      addNote(hardNotes, idHard, m, 3.5, 'touch');
      addNote(easyNotes, idEasy, m, 0, 'tap');
      addNote(easyNotes, idEasy, m, 2, 'tap');
    }

    // ---------------------------------------------------------
    // SECTION 15: OUTRO BREAKDOWN (M112 - M119, 194.8s - 208.7s)
    // Drums thin out, melody gently resolves
    // ---------------------------------------------------------
    else if (m < 120) {
      if (m % 2 === 0) {
        addNote(exNotes, idEx, m, 0, 'tap');
        addNote(exNotes, idEx, m, 1, 'tap');
        addNote(exNotes, idEx, m, 2, 'tap');
        addNote(exNotes, idEx, m, 3, 'tap');
        addNote(hardNotes, idHard, m, 0, 'tap');
        addNote(hardNotes, idHard, m, 2, 'tap');
        addNote(normalNotes, idNorm, m, 0, 'tap');
        addNote(normalNotes, idNorm, m, 2, 'tap');
        addNote(easyNotes, idEasy, m, 0, 'tap');
      } else {
        addNote(exNotes, idEx, m, 0, 'tap');
        addNote(exNotes, idEx, m, 1.5, 'touch');
        addNote(exNotes, idEx, m, 2, 'tap');
        addNote(exNotes, idEx, m, 2.5, 'touch');
        addNote(exNotes, idEx, m, 3, 'tap');
        addNote(hardNotes, idHard, m, 0, 'tap');
        addNote(hardNotes, idHard, m, 2, 'tap');
        addNote(normalNotes, idNorm, m, 0, 'tap');
        addNote(easyNotes, idEasy, m, 0, 'tap');
      }
    }

    // ---------------------------------------------------------
    // SECTION 16: FADE-OUT & FINAL ACCENT (M120 - M124, 208.7s - 215.7s)
    // Final echoing beats and closing hold
    // ---------------------------------------------------------
    else {
      if (m === 120) {
        addNote(exNotes, idEx, m, 0, 'tap');
        addNote(exNotes, idEx, m, 2, 'tap');
        addNote(hardNotes, idHard, m, 0, 'tap');
        addNote(normalNotes, idNorm, m, 0, 'tap');
        addNote(easyNotes, idEasy, m, 0, 'tap');
      } else if (m === 121) {
        addNote(exNotes, idEx, m, 0, 'tap');
        addNote(hardNotes, idHard, m, 0, 'tap');
        addNote(normalNotes, idNorm, m, 0, 'tap');
        addNote(easyNotes, idEasy, m, 0, 'tap');
      } else if (m === 122) {
        // Dramatic Final Full-Measure Hold closing the song!
        addNote(exNotes, idEx, m, 0, 'hold', 4.0);
        addNote(hardNotes, idHard, m, 0, 'hold', 3.0);
        addNote(normalNotes, idNorm, m, 0, 'hold', 2.0);
        addNote(easyNotes, idEasy, m, 0, 'hold', 2.0);
      }
    }
  }

  // Sort notes by time
  const sortNotes = (arr) => arr.sort((a, b) => a.time - b.time);
  sortNotes(easyNotes);
  sortNotes(normalNotes);
  sortNotes(hardNotes);
  sortNotes(exNotes);

  const fullChart = {
    id: 'bad_apple',
    title: 'Bad Apple!! feat. nomico',
    artist: 'Alstroemeria Records',
    bpm: BPM,
    offset: AUDIO_OFFSET,
    rotationPeriod: ROTATION_PERIOD,
    coverColor: '#1e3799',
    audioUrl: 'audio/bad_apple.mp3',
    climaxRanges: [
      [69.5, 83.5],   // Chorus 1
      [153.0, 180.9]  // Chorus 2 & Vocal Outro (Grand Climax)
    ],
    densityEvents: [
      { time: 0, density: 1.0 },
      { time: 13.9, density: 1.15, duration: 1.5 },
      { time: 55.6, density: 0.65, duration: 2.0 },  // 徐徐展开 in Pre-Chorus 1
      { time: 69.5, density: 0.60, duration: 1.5 },  // Wide 2-cycle view at Chorus 1 (Climax 1)
      { time: 83.5, density: 1.10, duration: 2.0 },  // Packs in breakdown
      { time: 97.4, density: 0.70, duration: 1.5 },  // Solo expansion
      { time: 139.1, density: 0.65, duration: 2.0 }, // Pre-Chorus 2 expansion
      { time: 153.0, density: 0.60, duration: 1.5 }, // Grand Climax Chorus 2
      { time: 194.8, density: 1.0, duration: 2.0 }   // Outro resolution
    ],
    difficulties: {
      EASY: {
        level: 3,
        color: '#00cec9',
        notes: easyNotes
      },
      NORMAL: {
        level: '5+',
        color: '#0984e3',
        notes: normalNotes
      },
      HARD: {
        level: 8,
        color: '#2e86de',
        notes: hardNotes
      },
      EX: {
        level: '9+',
        color: '#5f27cd',
        notes: exNotes
      }
    }
  };

  const outPath = path.join(chartsDir, 'bad_apple.json');
  fs.writeFileSync(outPath, JSON.stringify(fullChart, null, 2), 'utf8');
  console.log(`Successfully generated full-length Bad Apple chart!`);
  console.log(`- Total Duration: ~${round3(TOTAL_MEASURES * MEASURE_SEC)}s (${Math.floor(TOTAL_MEASURES * MEASURE_SEC / 60)}:${Math.floor((TOTAL_MEASURES * MEASURE_SEC) % 60).toString().padStart(2, '0')})`);
  console.log(`- EASY (LV.3): ${easyNotes.length} notes`);
  console.log(`- NORMAL (LV.5+): ${normalNotes.length} notes`);
  console.log(`- HARD (LV.8): ${hardNotes.length} notes`);
  console.log(`- EX (LV.9+): ${exNotes.length} notes`);
}

buildBadAppleFull();
