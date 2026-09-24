import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildMultiDifficultyChart } from './convert_chart.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const chartsDir = path.resolve(__dirname, '..', 'charts');

/**
 * Generates Bad Apple!! chart
 * BPM: 138 (Beat duration: 60 / 138 ≈ 0.4348s, 1 bar ≈ 1.7391s)
 */
function generateBadApple() {
  const bpm = 138;
  const beatSec = 60 / bpm;
  const rotationPeriod = Math.round(beatSec * 4 * 1000) / 1000; // 1.739s
  const rawNotes = [];
  let id = 1;

  // 64 measures of Bad Apple!! musical motifs (Intro, Verse, Buildup, Chorus)
  const totalMeasures = 48;
  const leadIn = 2; // 2 measures lead-in

  for (let m = 0; m < totalMeasures; m++) {
    const measureStart = (leadIn + m) * rotationPeriod;

    if (m < 8) {
      // Intro: 4 on the floor with subtle syncopations
      for (let b = 0; b < 4; b++) {
        const t = measureStart + b * beatSec;
        const angle = (b / 4) * 360;
        rawNotes.push({ id: id++, time: Math.round(t * 1000) / 1000, angle, type: 'tap', judged: false });
      }
      if (m % 2 === 1) {
        // Accent touch note
        const t = measureStart + 3.5 * beatSec;
        rawNotes.push({ id: id++, time: Math.round(t * 1000) / 1000, angle: (3.5 / 4) * 360, type: 'touch', judged: false });
      }
    } else if (m < 20) {
      // Verse: "Nagareteku toki no naka de demo..."
      // Driving 8th note rhythm with melodic holds
      for (let b = 0; b < 4; b += 0.5) {
        const t = measureStart + b * beatSec;
        const angle = (b / 4) * 360;

        if (b === 2.0 && m % 4 === 2) {
          // Melodic hold
          rawNotes.push({
            id: id++,
            time: Math.round(t * 1000) / 1000,
            angle,
            type: 'hold',
            duration: Math.round(1.5 * beatSec * 1000) / 1000,
            judged: false
          });
          b += 1.5; // skip past hold end so next note is in next measure
        } else if (b % 1 === 0.5 && m % 2 === 1) {
          rawNotes.push({ id: id++, time: Math.round(t * 1000) / 1000, angle, type: 'touch', judged: false });
        } else {
          rawNotes.push({ id: id++, time: Math.round(t * 1000) / 1000, angle, type: 'tap', judged: false });
        }
      }
    } else if (m < 28) {
      // Buildup: Snare rolls and accelerating patterns
      for (let b = 0; b < 4; b += (m >= 24 ? 0.25 : 0.5)) {
        const t = measureStart + b * beatSec;
        const angle = (b / 4) * 360;
        const type = (b % 2 === 1.5) ? 'touch' : 'tap';
        rawNotes.push({ id: id++, time: Math.round(t * 1000) / 1000, angle, type, judged: false });
      }
    } else {
      // Chorus: High energy, sweeping hold ribbons, diamond touches
      for (let b = 0; b < 4; b += 0.5) {
        const t = measureStart + b * beatSec;
        const angle = (b / 4) * 360;

        if (b === 0 && m % 4 === 0) {
          // 2-beat long hold arc
          rawNotes.push({
            id: id++,
            time: Math.round(t * 1000) / 1000,
            angle,
            type: 'hold',
            duration: Math.round(2.0 * beatSec * 1000) / 1000,
            judged: false
          });
          b += 2.0; // skip past full hold length
        } else if (b === 1.5 || b === 3.5) {
          rawNotes.push({ id: id++, time: Math.round(t * 1000) / 1000, angle, type: 'touch', judged: false });
        } else {
          rawNotes.push({ id: id++, time: Math.round(t * 1000) / 1000, angle, type: 'tap', judged: false });
        }
      }
    }
  }

  return buildMultiDifficultyChart({
    id: 'bad_apple',
    title: 'Bad Apple!! feat. nomico',
    artist: 'Alstroemeria Records',
    bpm,
    rotationPeriod,
    coverColor: '#1e3799',
    easyLevel: 2.8,
    normalLevel: 5.5,
    hardLevel: 8.0,
    exLevel: 9.6
  }, rawNotes);
}

/**
 * Generates Canon in D (Electro Rock) chart
 * BPM: 140 (Beat duration: 60 / 140 ≈ 0.4286s, 1 bar ≈ 1.7143s)
 */
function generateCanonInD() {
  const bpm = 140;
  const beatSec = 60 / bpm;
  const rotationPeriod = Math.round(beatSec * 4 * 1000) / 1000;
  const rawNotes = [];
  let id = 1;

  // Classic Pachelbel chord progression: D - A - Bm - F#m - G - D - G - A (8 bars per cycle)
  const totalBars = 40;
  const leadIn = 2;

  for (let bar = 0; bar < totalBars; bar++) {
    const barStart = (leadIn + bar) * rotationPeriod;
    const sectionIndex = Math.floor(bar / 8);

    if (sectionIndex === 0) {
      // Theme Intro: Elegant quarter note bassline with harmonic holds
      for (let b = 0; b < 4; b++) {
        const t = barStart + b * beatSec;
        const angle = (b / 4) * 360;
        if (b === 2 && bar % 2 === 1) {
          rawNotes.push({
            id: id++,
            time: Math.round(t * 1000) / 1000,
            angle,
            type: 'hold',
            duration: Math.round(1.5 * beatSec * 1000) / 1000,
            judged: false
          });
          b += 1.5;
        } else {
          rawNotes.push({ id: id++, time: Math.round(t * 1000) / 1000, angle, type: 'tap', judged: false });
        }
      }
    } else if (sectionIndex === 1) {
      // Arpeggios: Cascading 8th note circular runs
      for (let b = 0; b < 4; b += 0.5) {
        const t = barStart + b * beatSec;
        const angle = (b / 4) * 360;
        const type = (b === 1.5 || b === 3.5) ? 'touch' : 'tap';
        rawNotes.push({ id: id++, time: Math.round(t * 1000) / 1000, angle, type, judged: false });
      }
    } else if (sectionIndex === 2) {
      // Fast Violin Cadenza: 16th note triplets and hold spirals
      for (let b = 0; b < 4; b += 0.25) {
        const t = barStart + b * beatSec;
        const angle = (b / 4) * 360;
        if (b % 2 === 1 && bar % 2 === 0) {
          rawNotes.push({
            id: id++,
            time: Math.round(t * 1000) / 1000,
            angle,
            type: 'hold',
            duration: Math.round(0.75 * beatSec * 1000) / 1000,
            judged: false
          });
          b += 0.75;
        } else if (b % 1 === 0.75) {
          rawNotes.push({ id: id++, time: Math.round(t * 1000) / 1000, angle, type: 'touch', judged: false });
        } else {
          rawNotes.push({ id: id++, time: Math.round(t * 1000) / 1000, angle, type: 'tap', judged: false });
        }
      }
    } else {
      // Climax Finale: Heavy rock synth power chords with dual touch stars
      for (let b = 0; b < 4; b += 0.5) {
        const t = barStart + b * beatSec;
        const angle = (b / 4) * 360;
        if (b === 0) {
          rawNotes.push({
            id: id++,
            time: Math.round(t * 1000) / 1000,
            angle,
            type: 'hold',
            duration: Math.round(1.5 * beatSec * 1000) / 1000,
            judged: false
          });
          b += 1.5;
        } else if (b === 2.5 || b === 3.5) {
          rawNotes.push({ id: id++, time: Math.round(t * 1000) / 1000, angle, type: 'touch', judged: false });
        } else {
          rawNotes.push({ id: id++, time: Math.round(t * 1000) / 1000, angle, type: 'tap', judged: false });
        }
      }
    }
  }

  return buildMultiDifficultyChart({
    id: 'canon_in_d',
    title: 'Canon in D (Electro Rock)',
    artist: 'Johann Pachelbel (Arr. Cycline)',
    bpm,
    rotationPeriod,
    coverColor: '#00cec9',
    easyLevel: 2.2,
    normalLevel: 5.0,
    hardLevel: 7.5,
    exLevel: 9.3
  }, rawNotes);
}

// Generate and write charts
const badAppleChart = generateBadApple();
fs.writeFileSync(path.join(chartsDir, 'bad_apple.json'), JSON.stringify(badAppleChart, null, 2));
console.log('✓ Generated charts/bad_apple.json');

const canonChart = generateCanonInD();
fs.writeFileSync(path.join(chartsDir, 'canon_in_d.json'), JSON.stringify(canonChart, null, 2));
console.log('✓ Generated charts/canon_in_d.json');
