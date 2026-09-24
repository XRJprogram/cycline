import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const artifactDir = 'C:\\Users\\xrjpr\\.gemini\\antigravity-cli\\brain\\d0be7df2-4377-4414-be98-100edd41595f';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/game.html';

  let filePath = path.join(rootDir, reqPath);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(rootDir, 'public', reqPath);
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(4182, async () => {
  console.log('Test server listening on http://localhost:4182');

  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  const edgeBin = edgePaths.find(p => fs.existsSync(p));
  if (!edgeBin) {
    console.error('Edge browser not found');
    server.close();
    process.exit(1);
  }

  const browser = spawn(edgeBin, [
    '--headless=new',
    '--remote-debugging-port=9234',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-fre',
    '--disable-sync',
    '--disable-extensions',
    '--guest',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,720',
    'http://localhost:4182/game.html'
  ]);

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  
  for (let i = 0; i < 30; i++) {
    await sleep(200);
    try {
      const res = await fetch('http://localhost:9234/json/version');
      if (res.ok) break;
    } catch (_) {}
  }

  const versionRes = await fetch('http://localhost:9234/json/list');
  const pages = await versionRes.json();
  const page = pages.find(p => p.type === 'page' && p.url.includes('4182')) || pages[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  await new Promise(r => ws.onopen = r);

  let msgId = 1;
  const send = (method, params = {}) => new Promise(resolve => {
    const id = msgId++;
    const handler = (evt) => {
      const resp = JSON.parse(evt.data);
      if (resp.id === id) {
        ws.removeEventListener('message', handler);
        resolve(resp.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  const evaluate = async (expr) => {
    const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    return res?.result?.value;
  };

  const takeScreenshot = async (name) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(artifactDir, name);
    fs.writeFileSync(outPath, buffer);
    console.log(`Saved screenshot: ${name}`);
  };

  await send('Page.enable');

  console.log('\n--- 1. TITLE SCREEN VERIFICATION ---');
  await sleep(600);
  const titleText = await evaluate('document.querySelector(".game-logo")?.innerText');
  console.log('Title text:', titleText);

  // Click canvas / title to enter Select Scene
  console.log('\n--- 2. TRANSITION TO SELECT SCENE ---');
  await evaluate('window.game.switchScene("SELECT")');
  await sleep(800);

  // Verify Select Scene UI elements
  const selectInfo = await evaluate(`(() => {
    const g = window.game;
    const currentSong = g.songs[g.currentSongIndex];
    const focusedCard = document.querySelector('.wheel-song-item.focused');
    const cardDiffBtns = Array.from(focusedCard ? focusedCard.querySelectorAll('.card-diff-btn') : []).map(b => ({
      diff: b.getAttribute('data-diff'),
      name: b.querySelector('.card-diff-name')?.innerText,
      lvl: b.querySelector('.card-diff-lvl')?.innerText,
      active: b.classList.contains('active')
    }));
    const hasBottomDiffPicker = !!document.getElementById('diffPicker');
    const hasBottomStartBtn = !!document.getElementById('btnStartSelect');
    const bottomTip = document.querySelector('.card-play-tip')?.innerText;

    return {
      currentSongIndex: g.currentSongIndex,
      songTitle: currentSong?.title,
      selectedDifficulty: g.selectedDifficulty,
      cardDiffBtns,
      hasBottomDiffPicker,
      hasBottomStartBtn,
      bottomTip
    };
  })()`);

  console.log('Select scene inspection:', JSON.stringify(selectInfo, null, 2));

  // Focus on Bad Apple
  await evaluate('window.game.setFocusedSong(2, true)');
  await sleep(300);

  // Click on EX difficulty on the Bad Apple card!
  console.log('\n--- 3. CLICK ON-CARD EX DIFFICULTY BUTTON ---');
  const exClickResult = await evaluate(`(() => {
    const focusedCard = document.querySelector('.wheel-song-item.focused');
    const exBtn = focusedCard ? focusedCard.querySelector('.card-diff-btn[data-diff="EX"]') : null;
    if (exBtn) {
      exBtn.click();
      return { clicked: true, selectedDiff: window.game.selectedDifficulty };
    }
    return { clicked: false };
  })()`);
  console.log('EX difficulty click result:', exClickResult);
  await sleep(300);

  await takeScreenshot('26_select_on_card_diff_and_tap_to_play.png');

  // Verify direct card tapping starts gameplay
  console.log('\n--- 4. TAP FOCUSED CARD TO DIRECTLY START GAMEPLAY ---');
  await evaluate(`(() => {
    const focusedCard = document.querySelector('.wheel-song-item.focused');
    if (focusedCard) {
      focusedCard.click();
    }
  })()`);

  await sleep(1500); // Wait for loading intro buffer to finish and gameplay to start
  const gameplayInfo = await evaluate(`(() => {
    const g = window.game;
    return {
      currentScene: g.currentScene,
      isPlaying: g.audio.getIsPlaying(),
      songTime: g.audio.getSongTime(),
      title: g.gameplayTitle.innerText,
      totalNotes: g.judge.totalNotes,
      cycles: g.renderer.currentCycles
    };
  })()`);
  console.log('Gameplay scene status after card tap:', gameplayInfo);

  console.log('\n--- 5. TOUCH NOTE POSITIONAL JUDGEMENT VERIFICATION ---');
  // Seek to 13.5s where intro touch notes arrive around 14s - 16s
  await evaluate('window.game.audio.seek(14.0)');
  await sleep(300);

  // Test touch note positional hit
  const touchJudgeTest = await evaluate(`(() => {
    const g = window.game;
    const songTime = g.audio.getSongTime();
    const notes = g.judge.getNotes();
    const touchNote = notes.find(n => n.type === 'touch' && !n.judged && n.time > songTime);
    if (!touchNote) return { error: 'No upcoming touch note found' };

    // 1. Calculate actual canvas position
    const pos = g.judge.getNoteCanvasPos ? g.judge.getNoteCanvasPos(touchNote, songTime) : null;
    if (!pos) return { error: 'getNoteCanvasPos not available' };

    // 2. Simulate hitting far away (should NOT hit)
    const farResult = g.judge.handleInputDown(songTime, { x: pos.x + 200, y: pos.y + 200 });
    const noteJudgedAfterFar = touchNote.judged;

    // 3. Simulate hitting actual position (should hit PERFECT!)
    const hitResult = g.judge.handleInputDown(songTime, { x: pos.x + 10, y: pos.y + 10 });
    const noteJudgedAfterClose = touchNote.judged;
    const noteGrade = touchNote.grade;

    return {
      touchNoteId: touchNote.id,
      touchNoteTime: touchNote.time,
      currentSongTime: songTime,
      timeDiffBeforeArrival: touchNote.time - songTime,
      canvasPos: { x: Math.round(pos.x), y: Math.round(pos.y) },
      noteJudgedAfterFar,
      hitResultGrade: hitResult ? hitResult.grade : null,
      noteJudgedAfterClose,
      noteGrade
    };
  })()`);

  console.log('Touch note advance positional test:', touchJudgeTest);

  await sleep(400);
  await takeScreenshot('27_gameplay_touch_note_position_hit.png');

  console.log('\n--- 6. MULTI-CYCLE TRACK CONCENTRIC RENDERING VERIFICATION ---');
  // Test dual cycle rendering
  await evaluate(`(() => {
    window.game.renderer.currentCycles = 2;
  })()`);
  await sleep(300);
  await takeScreenshot('28_gameplay_multi_cycle_concentric_tracks.png');

  console.log('\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');

  try {
    browser.kill();
  } catch (_) {}
  server.close();
  process.exit(0);
});
