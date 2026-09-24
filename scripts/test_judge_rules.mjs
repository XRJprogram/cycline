import { JudgeEngine } from '../src/core/JudgeEngine.js';

// Test mock chart
const mockChart = {
  id: 'test',
  title: 'Test Song',
  artist: 'Tester',
  bpm: 120,
  offset: 0,
  rotationPeriod: 2.0,
  difficulty: 'NORMAL',
  level: 5.0,
  notes: [
    { id: 1, time: 1.0, angle: 0, type: 'tap', judged: false },
    { id: 2, time: 2.0, angle: 90, type: 'touch', judged: false },
    { id: 3, time: 3.0, angle: 180, type: 'hold', duration: 1.0, judged: false },
    { id: 4, time: 5.0, angle: 270, type: 'touch', judged: false },
  ]
};

console.log('--- TEST 1: Config Check ---');
const judge = new JudgeEngine();
judge.loadChart(mockChart);
// check private config via hitting at 119ms vs 125ms
judge.handleInputDown(1.119); // 119ms offset -> should be GOOD (within 120ms)
const notes = judge.getNotes();
console.log('Tap at +119ms grade:', notes[0].grade);
if (notes[0].grade !== 'GOOD') {
  console.error('FAIL: Expected GOOD for 119ms');
} else {
  console.log('PASS: 119ms is GOOD (120ms window verified)');
}

console.log('--- TEST 2: Touch Note 120ms Rule ---');
// Touch note at 2.0s hit at 2.115s (+115ms)
judge.handleInputDown(2.115);
console.log('Touch at +115ms grade:', notes[1].grade);
if (notes[1].grade !== 'PERFECT') {
  console.error('FAIL: Expected PERFECT for Touch note within 120ms');
} else {
  console.log('PASS: Touch note at 115ms is judged PERFECT');
}

console.log('--- TEST 3: AP and FC breakage rules ---');
// In test 1, note 1 got GOOD, so AP should be broken, but FC should still be intact
console.log('isAP after GOOD note:', judge.isAP, '(expected false)');
console.log('isFC after GOOD note:', judge.isFC, '(expected true)');
if (judge.isAP === false && judge.isFC === true) {
  console.log('PASS: AP broke on GOOD, FC still intact');
} else {
  console.error('FAIL: AP or FC state incorrect');
}

console.log('--- TEST 4: Rank System ---');
const apJudge = new JudgeEngine();
apJudge.loadChart({
  ...mockChart,
  notes: [
    { id: 1, time: 1.0, angle: 0, type: 'tap', judged: false },
    { id: 2, time: 2.0, angle: 90, type: 'touch', judged: false }
  ]
});
apJudge.handleInputDown(1.0); // PERFECT
apJudge.handleInputDown(2.08); // Touch note within 80ms -> PERFECT
const apSummary = apJudge.getResultSummary('Test', 'NORMAL');
console.log('AP Summary:', { score: apSummary.score, rank: apSummary.rank, badge: apSummary.badge });
if (apSummary.rank === 'SSS' && apSummary.badge === 'AP') {
  console.log('PASS: AP yields SSS rank and AP badge');
} else {
  console.error('FAIL: Expected SSS rank and AP badge for AP');
}

console.log('All Judge Engine rule tests complete!');
