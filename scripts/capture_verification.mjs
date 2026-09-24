import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const userDataDir = path.join(process.env.TEMP, 'edge_verify2_' + Date.now());
const cdpPort = 9228;

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
    await wait(1200);

    // 1. Screenshot of Song Select: rails and ticks fade out toward edges with cards
    const shotSelect = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(rootDir, 'screenshot_select_faded_rails.png'), Buffer.from(shotSelect.data, 'base64'));
    console.log('Saved screenshot_select_faded_rails.png');

    // 2. Select Bad Apple and start gameplay (Intro: 0s ~ 14s is clean solid circle, no hour dots)
    await send('Runtime.evaluate', {
      expression: `
        const game = window.game;
        if (game) {
          game.setFocusedSong(0);
          game.selectDifficulty('NORMAL');
          document.getElementById('btnStartSelect').click();
        }
      `
    });

    // Wait past intro banner to 5s of gameplay (normal verse, solid circle, no dots)
    await wait(4500);
    const shotClean = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(rootDir, 'screenshot_gameplay_clean_circle.png'), Buffer.from(shotClean.data, 'base64'));
    console.log('Saved screenshot_gameplay_clean_circle.png');

    // 3. Jump to climax section (16s) to verify intentional dynamic Fourier morphing
    await send('Runtime.evaluate', {
      expression: `
        const game = window.game;
        if (game) {
          game.audio.seek(16.5);
        }
      `
    });
    await wait(600);
    const shotClimax = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(rootDir, 'screenshot_gameplay_climax_wave.png'), Buffer.from(shotClimax.data, 'base64'));
    console.log('Saved screenshot_gameplay_climax_wave.png');

    ws.close();
  } catch (e) {
    console.error('Error:', e);
  } finally {
    edgeProcess.kill();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
  }
}

run();
