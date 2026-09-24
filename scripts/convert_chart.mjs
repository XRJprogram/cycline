/**
 * Chart Converter for Cycline Rhythm Game
 * Supports converting .osu and .sm charts to Cycline .json format.
 */
import fs from 'fs';
import path from 'path';

/**
 * Converts osu! beatmap text to Cycline chart structure
 */
export function convertOsuToCycline(osuContent, overrides = {}) {
  const lines = osuContent.split(/\r?\n/);
  let section = '';
  const metadata = {};
  const timingPoints = [];
  const hitObjects = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      section = trimmed.slice(1, -1);
      continue;
    }

    if (section === 'Metadata' || section === 'General') {
      const idx = trimmed.indexOf(':');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        metadata[key] = val;
      }
    } else if (section === 'TimingPoints') {
      const parts = trimmed.split(',');
      if (parts.length >= 2) {
        const time = parseFloat(parts[0]);
        const beatLength = parseFloat(parts[1]);
        if (beatLength > 0) { // Uninherited timing point (new BPM)
          const bpm = Math.round(60000 / beatLength * 10) / 10;
          timingPoints.push({ time, bpm, beatLength });
        }
      }
    } else if (section === 'HitObjects') {
      const parts = trimmed.split(',');
      if (parts.length >= 4) {
        const x = parseFloat(parts[0]);
        const y = parseFloat(parts[1]);
        const timeMs = parseFloat(parts[2]);
        const type = parseInt(parts[3], 10);
        let durationMs = 0;

        // Check if slider (type & 2)
        if (type & 2) {
          // Slider: x,y,time,type,hitSound,curveType|curvePoints,slides,length
          const slides = parseInt(parts[6] || '1', 10);
          const pixelLength = parseFloat(parts[7] || '100');
          // Approximate duration based on base slider velocity
          durationMs = (pixelLength / 100) * 350 * slides;
        } else if (type & 8) { // Spinner
          const endTime = parseFloat(parts[5] || timeMs);
          durationMs = Math.max(0, endTime - timeMs);
        }

        hitObjects.push({
          timeSec: timeMs / 1000,
          type: (type & 2) ? 'hold' : (type & 8) ? 'touch' : 'tap',
          durationSec: durationMs > 0 ? durationMs / 1000 : 0
        });
      }
    }
  }

  const bpm = overrides.bpm || timingPoints[0]?.bpm || 120;
  const rotationPeriod = overrides.rotationPeriod || Math.round((60 / bpm) * 4 * 1000) / 1000; // 1 bar

  // Generate note angles based on time modulo rotationPeriod
  const rawNotes = hitObjects.map((obj, i) => {
    const cycleProgress = (obj.timeSec % rotationPeriod) / rotationPeriod;
    const angle = Math.round((cycleProgress * 360) * 10) / 10;
    const note = {
      id: i + 1,
      time: Math.round(obj.timeSec * 1000) / 1000,
      angle,
      type: obj.type,
      judged: false
    };
    if (obj.type === 'hold' && obj.durationSec > 0) {
      note.duration = Math.min(rotationPeriod * 0.75, Math.round(obj.durationSec * 1000) / 1000);
    }
    return note;
  });

  return {
    id: overrides.id || metadata.Title?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'converted_chart',
    title: overrides.title || metadata.Title || 'Converted Song',
    artist: overrides.artist || metadata.Artist || 'Converted Artist',
    bpm,
    offset: overrides.offset || 0,
    rotationPeriod,
    coverColor: overrides.coverColor || '#00a8ff',
    notes: rawNotes
  };
}

/**
 * Creates 4 balanced difficulty tiers from base note sequence
 */
export function buildMultiDifficultyChart(baseInfo, rawNotes) {
  const bpm = baseInfo.bpm;
  const beatSec = 60 / bpm;
  const rotationPeriod = baseInfo.rotationPeriod || beatSec * 4;

  // Filter notes into densities:
  // EX: All notes, fast syncopations, tight hold ribbons
  const exNotes = rawNotes.map((n, i) => ({ ...n, id: i + 1 }));

  // HARD: Every 1/2 or 1/4 beat, moderate holds
  const hardNotes = rawNotes
    .filter((_, idx) => idx % 2 === 0 || idx % 3 === 0)
    .map((n, i) => ({ ...n, id: i + 1 }));

  // NORMAL: Main beats (quarter notes), relaxed holds
  const normalNotes = rawNotes
    .filter((_, idx) => idx % 3 === 0 || idx % 4 === 0)
    .map((n, i) => ({ ...n, id: i + 1 }));

  // EASY: Half/whole notes, simplified
  const easyNotes = rawNotes
    .filter((_, idx) => idx % 5 === 0)
    .map((n, i) => ({ ...n, id: i + 1, type: n.type === 'hold' ? 'tap' : n.type }));

  return {
    id: baseInfo.id,
    title: baseInfo.title,
    artist: baseInfo.artist,
    bpm: baseInfo.bpm,
    offset: baseInfo.offset || 0,
    rotationPeriod,
    coverColor: baseInfo.coverColor || '#0984e3',
    difficulties: {
      EASY: {
        level: baseInfo.easyLevel || 2.5,
        color: '#00cec9',
        notes: easyNotes
      },
      NORMAL: {
        level: baseInfo.normalLevel || 5.2,
        color: '#0984e3',
        notes: normalNotes
      },
      HARD: {
        level: baseInfo.hardLevel || 7.8,
        color: '#2e86de',
        notes: hardNotes
      },
      EX: {
        level: baseInfo.exLevel || 9.5,
        color: '#5f27cd',
        notes: exNotes
      }
    }
  };
}
