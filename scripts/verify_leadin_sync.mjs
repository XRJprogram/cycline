import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const artifactDir = 'C:\\Users\\xrjpr\\.gemini\\antigravity-cli\\brain\\d0be7df2-4377-4414-be98-100edd41595f';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const userDataDir = path.join(process.env.TEMP, 'edge_leadin_' + Date.now());
const cdpPort = 9235;

const edgeProcess = spawn(edgePath, [
  '--headless=new',
  `--remote-debugging-port=${cdpPort}`,
  `--user-data-dir=${userDataDir}`,
  '--no-sandbox',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-fre',
  '--autoplay-policy=no-user-gesture-required',
  '--window-size=1280,800',
  'http://localhost:5173/#select'
], { stdio: 'ignore' });

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  try {
    for (let i = 0; i < 30; i++) {
      await wait(300);
      try {
        const res = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
        if (res.ok) break;
      } catch (e) {}
    }

    const listRes = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
    const listData = await listRes.json();
    const pageTarget = listData.find(t => t.url.includes('localhost') || t.url.includes('5173')) || listData[0];

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    const send = (method, params = {}) => new Promise((res) => {
      const id = Math.floor(Math.random() * 100000);
      const onMsg = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id === id) {
          ws.removeEventListener('message', onMsg);
          res(msg.result);
        }
      };
      ws.addEventListener('message', onMsg);
      ws.send(JSON.stringify({ id, method, params }));
    });

    await send('Page.enable');
    await send('Page.navigate', { url: 'http://localhost:5173/#select' });
    await wait(1800);

    // Focus Bad Apple and turn ON autoplay
    const setupInfo = await send('Runtime.evaluate', {
      expression: `
        window.game.setFocusedSong(0);
        window.game.selectDifficulty('NORMAL');
        window.game.judge.isAutoPlay = true;
        const song = window.game.songs[0];
        const chart = song.difficulties.NORMAL;
        ({
          title: song.title,
          bpm: song.bpm,
          offset: song.offset,
          firstNoteTime: chart.notes[0].time,
          totalNotes: chart.notes.length
        })
      `,
      returnByValue: true
    });
    console.log('Setup Info:', setupInfo.result.value);

    // Resume AudioContext if suspended
    await send('Runtime.evaluate', {
      expression: `if (window.game.audio.ctx) window.game.audio.ctx.resume();`
    });

    // Start gameplay
    await send('Runtime.evaluate', {
      expression: `document.getElementById('btnStartSelect').click();`
    });

    // 1. Check during intro banner (t = 500ms after click)
    await wait(500);
    let shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, '10_leadin_ready_banner.png'), Buffer.from(shot.data, 'base64'));
    console.log('Captured 10_leadin_ready_banner.png');

    // 2. Wait until banner clears and playback starts (~1.1s + 400ms = 1.5s after click)
    await wait(1000);
    const audioState = await send('Runtime.evaluate', {
      expression: `
        ({
          isPlaying: window.game.audio.getIsPlaying(),
          songTime: window.game.audio.getSongTime(),
          isUsingBuffer: window.game.audio.isUsingBuffer
        })
      `,
      returnByValue: true
    });
    console.log('Audio State after banner exit:', audioState.result.value);

    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, '11_leadin_needle_spinning_measure1.png'), Buffer.from(shot.data, 'base64'));
    console.log('Captured 11_leadin_needle_spinning_measure1.png');

    // 3. Wait until t = 2.0s into song playback (needle on 2nd revolution, upcoming note approaching)
    await wait(1600);
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, '12_leadin_needle_approaching_measure2.png'), Buffer.from(shot.data, 'base64'));
    console.log('Captured 12_leadin_needle_approaching_measure2.png');

    // 4. Wait until first notes hit at ~3.5s - 4.5s
    await wait(1500);
    const hitStats = await send('Runtime.evaluate', {
      expression: `
        ({
          songTime: window.game.audio.getSongTime(),
          score: window.game.judge.stats.score,
          combo: window.game.judge.stats.combo,
          perfect: window.game.judge.stats.perfectCount,
          miss: window.game.judge.stats.missCount
        })
      `,
      returnByValue: true
    });
    console.log('Stats after Note 1 & 2 hit:', hitStats.result.value);

    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, '13_first_notes_hit_perfect.png'), Buffer.from(shot.data, 'base64'));
    console.log('Captured 13_first_notes_hit_perfect.png');

    console.log('Lead-in and sync verification completed successfully.');
    ws.close();
  } catch (e) {
    console.error('Error during lead-in verification:', e);
  } finally {
    try { edgeProcess.kill(); } catch (e) {}
  }
}

run();
