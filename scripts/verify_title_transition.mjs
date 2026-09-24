import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const artifactDir = 'C:\\Users\\xrjpr\\.gemini\\antigravity-cli\\brain\\d0be7df2-4377-4414-be98-100edd41595f';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const userDataDir = path.join(process.env.TEMP, 'edge_transition_' + Date.now());
const cdpPort = 9226;

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
  'http://localhost:5173/'
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
    await send('Page.navigate', { url: 'http://localhost:5173/' });
    await wait(1500);

    // 1. Initial Title screen
    let shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, '01_title_initial.png'), Buffer.from(shot.data, 'base64'));
    console.log('Captured 01_title_initial.png');

    // Click anywhere on sceneTitle to trigger start
    await send('Runtime.evaluate', {
      expression: `document.getElementById('sceneTitle').click();`
    });

    // 2. Mid title exit (t = 80ms)
    await wait(80);
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, '02_title_exit_80ms.png'), Buffer.from(shot.data, 'base64'));
    console.log('Captured 02_title_exit_80ms.png');

    // 3. Early select entrance (t = 260ms, i.e. 80ms after switchScene)
    await wait(180);
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, '03_select_enter_260ms.png'), Buffer.from(shot.data, 'base64'));
    console.log('Captured 03_select_enter_260ms.png');

    // 4. Mid select rising (t = 450ms)
    await wait(190);
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, '04_select_rising_450ms.png'), Buffer.from(shot.data, 'base64'));
    console.log('Captured 04_select_rising_450ms.png');

    // 5. Select fully settled (t = 900ms)
    await wait(450);
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, '05_select_settled_900ms.png'), Buffer.from(shot.data, 'base64'));
    console.log('Captured 05_select_settled_900ms.png');

    // Also check Bad Apple in song select
    await send('Runtime.evaluate', {
      expression: `window.game.setFocusedSong(2);` // Bad Apple is index 2
    });
    await wait(300);
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, '06_bad_apple_selected.png'), Buffer.from(shot.data, 'base64'));
    console.log('Captured 06_bad_apple_selected.png');

    console.log('All verification captures completed successfully.');
    ws.close();
  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    try {
      edgeProcess.kill();
    } catch (e) {}
  }
}

run();
