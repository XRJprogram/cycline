import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const artifactDir = 'C:\\Users\\xrjpr\\.gemini\\antigravity-cli\\brain\\d0be7df2-4377-4414-be98-100edd41595f';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const userDataDir = path.join(process.env.TEMP, 'edge_badapple_' + Date.now());
const cdpPort = 9227;

const edgeProcess = spawn(edgePath, [
  '--headless=new',
  `--remote-debugging-port=${cdpPort}`,
  `--user-data-dir=${userDataDir}`,
  '--no-sandbox',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-fre',
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
    await wait(1500);

    // Select Track 01 (Bad Apple) and EX difficulty
    const chartInfo = await send('Runtime.evaluate', {
      expression: `
        window.game.setFocusedSong(0);
        window.game.selectDifficulty('EX');
        const song = window.game.songs[0];
        const chart = song.difficulties.EX;
        ({
          title: song.title,
          level: chart.level,
          noteCount: chart.notes.length,
          duration: chart.notes[chart.notes.length - 1].time,
          hasClimax: chart.climaxRanges.length,
          densityEvents: chart.densityEvents.length
        })
      `,
      returnByValue: true
    });
    console.log('Bad Apple EX Chart Info:', chartInfo.result.value);

    // Start gameplay
    await send('Runtime.evaluate', {
      expression: `document.getElementById('btnStartSelect').click();`
    });

    // Wait past intro banner
    await wait(2200);

    let shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, '07_bad_apple_gameplay_intro.png'), Buffer.from(shot.data, 'base64'));
    console.log('Captured 07_bad_apple_gameplay_intro.png');

    // Seek to Chorus 1 climax section (time = 72s)
    await send('Runtime.evaluate', {
      expression: `
        window.game.audio.seek(72.0);
      `
    });
    await wait(500);

    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, '08_bad_apple_chorus_climax.png'), Buffer.from(shot.data, 'base64'));
    console.log('Captured 08_bad_apple_chorus_climax.png');

    console.log('Bad Apple gameplay verification finished.');
    ws.close();
  } catch (err) {
    console.error('Error during Bad Apple verification:', err);
  } finally {
    try {
      edgeProcess.kill();
    } catch (e) {}
  }
}

run();
