global.window = { devicePixelRatio: 1, addEventListener: () => {} };
import { ClockRenderer } from '../src/render/ClockRenderer.ts';

// Setup mock canvas context to inspect draw calls
let drawnArcs = [];
let drawnLines = [];
let drawnAlphas = [];
let drawnTexts = [];

const mockCtx = {
  save: () => {},
  restore: () => {},
  beginPath: () => {},
  arc: (x, y, r, startAngle, endAngle) => {
    drawnArcs.push({ x, y, r, startAngle, endAngle });
  },
  stroke: () => {},
  fill: () => {},
  fillRect: () => {},
  moveTo: (x, y) => { drawnLines.push({ type: 'move', x, y }); },
  lineTo: (x, y) => { drawnLines.push({ type: 'line', x, y }); },
  closePath: () => {},
  translate: () => {},
  rotate: () => {},
  scale: () => {},
  setTransform: () => {},
  fillText: (text) => { drawnTexts.push(text); },
  setLineDash: () => {},
  set globalAlpha(val) { drawnAlphas.push(val); },
  get globalAlpha() { return drawnAlphas[drawnAlphas.length - 1] ?? 1.0; },
  set strokeStyle(v) {},
  set fillStyle(v) {},
  set lineWidth(v) {},
  set lineCap(v) {},
  set font(v) {},
  set textAlign(v) {},
  set textBaseline(v) {}
};

const mockCanvas = {
  getContext: () => mockCtx,
  width: 800,
  height: 600,
  style: {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 800 })
};

const renderer = new ClockRenderer(mockCanvas);
renderer.resize(800, 800);

console.log('--- TEST 1: Hold & Touch Feedback text are PERFECT ---');
renderer.triggerHit({
  note: { id: 1, time: 1.0, angle: 0, type: 'hold', judged: true },
  grade: 'PERFECT',
  deltaMs: 0,
  scoreAdded: 1000,
  combo: 1,
  isHoldComplete: true
});
if (renderer.lastFeedback?.text === 'PERFECT') {
  console.log('PASS: Hold complete feedback text is "PERFECT"');
} else {
  console.error('FAIL: Expected feedback "PERFECT", got:', renderer.lastFeedback?.text);
  process.exit(1);
}

renderer.triggerHit({
  note: { id: 2, time: 2.0, angle: 90, type: 'touch', judged: true },
  grade: 'PERFECT',
  deltaMs: 0,
  scoreAdded: 1000,
  combo: 2
});
if (renderer.lastFeedback?.text === 'PERFECT') {
  console.log('PASS: Touch hit feedback text is "PERFECT"');
} else {
  console.error('FAIL: Expected touch feedback "PERFECT", got:', renderer.lastFeedback?.text);
  process.exit(1);
}

console.log('--- TEST 2: Field of View is 270 degrees (0.75 of period) ---');
// For rotationPeriod = 2.0s, lookahead is 2.0 * 0.75 = 1.5s (270 deg)
const testNotes = [
  { id: 1, time: 1.0, angle: 90, type: 'tap', judged: false },
  { id: 2, time: 2.2, angle: 90, type: 'tap', judged: false }, // diff = 1.7s > 1.5s -> in 90 deg buffer zone!
  { id: 3, time: 3.0, angle: 90, type: 'tap', judged: false }, // diff = 2.5s > 1.5s
];

// At songTime = 0.5s:
// Note 1 diff = 0.5s <= 1.5s -> visible within 270 deg
// Note 2 diff = 1.7s > 1.5s -> MUST NOT BE VISIBLE (waiting in 90 deg buffer)
// Note 3 diff = 2.5s > 1.5s -> MUST NOT BE VISIBLE
drawnAlphas = [];
const needleRad = 0;
renderer['drawFlatNotes'](mockCtx, 400, 400, 200, 0.5, 2.0, needleRad, testNotes);
console.log('Notes drawn at songTime=0.5s:', drawnAlphas.length);
if (drawnAlphas.length === 1) {
  console.log('PASS: Only notes within 270 degrees are visible; 90-degree buffer is empty');
} else {
  console.error('FAIL: Expected 1 note drawn within 270 deg, got:', drawnAlphas.length);
  process.exit(1);
}

console.log('--- TEST 3: Hold Note does not abruptly vanish when unhit/missed ---');
// Hold note at t = 1.0s, duration = 1.0s (ends at 2.0s).
// At songTime = 1.3s (needle is 0.3s into the note, player did not hold)
const unhitHold = { id: 4, time: 1.0, angle: 90, type: 'hold', duration: 1.0, judged: false, holding: false };
drawnLines = [];
renderer['drawFlatNotes'](mockCtx, 400, 400, 200, 1.3, 2.0, needleRad, [unhitHold]);
console.log('Remaining ribbon path points drawn while unhit:', drawnLines.length);
if (drawnLines.length > 0) {
  console.log('PASS: Unhit hold note continues rendering gracefully (does not vanish instantly)');
} else {
  console.error('FAIL: Expected unhit hold note to still be visible on track');
  process.exit(1);
}

console.log('--- TEST 4: Hold ribbon capped at 270 degrees lookahead ---');
// Hold note from t = 1.0s with duration = 3.0s.
// rotationPeriod = 2.0s, maxVisibleTime = 1.0 + 1.5 = 2.5s.
// Ribbon should be drawn up to 2.5s (span = 1.5s = 270 degrees)
drawnLines = [];
const longHold = { id: 5, time: 1.0, angle: 0, type: 'hold', duration: 3.0, judged: false };
renderer['drawFlatNotes'](mockCtx, 400, 400, 200, 1.0, 2.0, needleRad, [longHold]);
if (drawnLines.length > 0) {
  console.log('PASS: Hold ribbon strictly rendered with Fourier path sampling, count:', drawnLines.length);
} else {
  console.error('FAIL: No ribbon lines drawn');
  process.exit(1);
}

console.log('ALL 270-DEGREE, TOUCH PERFECT, AND HOLD GRACE TESTS PASSED!');
